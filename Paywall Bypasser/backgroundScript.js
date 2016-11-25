'use strict';

var includedSites = {
  'Harvard Business Review': 'hbr.org',
  'Inc.com': 'inc.com'
};   

function setDefaultOptions() {
  chrome.storage.sync.set({
    sites: includedSites
  }, function() {
    chrome.tabs.create({ 'url': 'chrome://extensions/?options=' + chrome.runtime.id });
  });
}



// Get the enabled sites
chrome.storage.sync.get({
  sites: {}
}, function(items) {
  var sites = items.sites;
  enabledSites = Object.keys(items.sites).map(function(key) {
    return items.sites[key];
  });
});

// Listen for changes to options
chrome.storage.onChanged.addListener(function(changes, namespace) {
  var key;
  for (key in changes) {
    var storageChange = changes[key];
    if (key === 'sites') {
      var sites = storageChange.newValue;
      enabledSites = Object.keys(sites).map(function(key) {
        return sites[key];
      });
    }
  }
});

chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
  if (blockedRegexes.some(function(regex) { return regex.test(details.url); })) {
    return { cancel: true };
  }

  var isEnabled = enabledSites.some(function(enabledSite) {

    var useSite = details.url.indexOf(enabledSite) !== -1;

    if (enabledSite in restrictions) {
      return useSite && details.url.indexOf(restrictions[enabledSite]) !== -1;
    }

    return useSite;

  });

  if (!isEnabled) {
    return;
  }

  var requestHeaders = details.requestHeaders;
  var tabId = details.tabId;

  var setReferer = false;

  // if referer exists, set it to google
  requestHeaders = requestHeaders.map(function(requestHeader) {
    if (requestHeader.name === 'Referer') {
      requestHeader.value = 'https://www.google.com/';
      setReferer = true;
    }
    return requestHeader;
  });

  // otherwise add it
  if (!setReferer) {
    requestHeaders.push({
      name: 'Referer',
      value: 'https://www.google.com/'
    });
  }

  // remove cookies
  requestHeaders = requestHeaders.map(function(requestHeader) {
    if (requestHeader.name === 'Cookie') {
      requestHeader.value = '';
    }
    return requestHeader;
  });

  if (tabId !== -1) {
    // run tabScript inside tab
    chrome.tabs.executeScript(tabId, {
      file: 'tabScript.js',
      runAt: 'document_start'
    }, function(res) {
      if (chrome.runtime.lastError || res[0]) {
        return;
      }
    });
  }

  return { requestHeaders: requestHeaders };
}, {
  urls: ['<all_urls>']
}, ['blocking', 'requestHeaders']);