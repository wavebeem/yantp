/* global chrome */

function throttle(time, fn) {
  let lastRun = Date.now();
  return () => {
    const now = Date.now();
    const delta = now - lastRun;
    if (delta >= time) {
      lastRun = now;
      return fn.apply(this, arguments);
    }
    return undefined;
  };
}

function appendText(elem, text) {
  elem.appendChild(document.createTextNode(text));
}

function ID(id) {
  return document.getElementById(id);
}

function listen(obj, name, cb, capture) {
  obj.addEventListener(name, cb, !!capture);
}

function img(url) {
  var elem = document.createElement('span');
  var backgroundImage = '-webkit-image-set(' + [
    'url(chrome://favicon/size/16@1x/' + url + ') 1x',
    'url(chrome://favicon/size/16@2x/' + url + ') 2x'
  ].join(', ') + ')';
  elem.style.backgroundImage = backgroundImage;
  elem.className = 'image';
  return elem;
}

function favicon(url) {
  var elem = document.createElement('span');
  var image = img(url);
  elem.className = 'favicon';
  elem.appendChild(image);
  return elem;
}

function title(title) {
  var elem = document.createElement('span');
  elem.className = 'title';
  appendText(elem, title);
  return elem;
}

function walkBookmarks(node, callback, path) {
  if (!node) {
    return;
  }

  if (node.url) {
    callback(node, path);
  } else if (node.children) {
    node.children.forEach(child => {
      walkBookmarks(child, callback, (path || []).concat(node.title));
    });
  } else {
    throw new Error('What kind of bookmark node is this?');
  }
}

function generatePath(path) {
  var elem = document.createElement('span');
  elem.className = 'path';

  path.forEach(chunk => {
    var chunkElem = document.createElement('span');
    var sepElem = document.createElement('span');

    chunkElem.className = 'chunk';
    sepElem.className = 'separator';

    appendText(chunkElem, chunk);
    appendText(sepElem, ' / ');

    elem.appendChild(chunkElem);
    elem.appendChild(sepElem);
  });

  return elem;
}

function generateLink(site, path) {
  var elem;

  elem = document.createElement('a');
  elem.className = 'node top-site';
  elem.appendChild(favicon(site.url));
  if (path) {
    elem.appendChild(generatePath(path));
  }
  elem.appendChild(title(site.title));
  elem.href = site.url;

  return elem;
}

function render() {
  if (!tabs['top-sites'] || !tabs.bookmarks || !tabs.others) {
    return;
  }

  tabs['top-sites'].innerHTML = '';
  chrome.topSites.get(sites => {
    sites.forEach(site => {
      tabs['top-sites'].appendChild(generateLink(site));
    });
  });

  renderBookmarksSubtreeByIdInto('1', tabs.bookmarks);
  renderBookmarksSubtreeByIdInto('2', tabs.others);
}

function emptyMessage() {
  var elem = document.createElement('p');
  elem.className = 'empty-message';
  elem.appendChild(document.createTextNode(
    'This is where bookmarks would go, if you had any'
  ));
  return elem;
}

function renderBookmarksSubtreeByIdInto(bookmarkId, rootElem) {
  rootElem.innerHTML = '';
  chrome.bookmarks.getSubTree(bookmarkId, nodes => {
    if (nodes[0].children.length === 0) {
      rootElem.appendChild(emptyMessage());
    } else {
      nodes[0].children.forEach(node => {
        walkBookmarks(node, (bookmark, path) => {
          var elem = generateLink(bookmark, path);
          rootElem.appendChild(elem);
        });
      });
    }
  });
}

var tabHandlers = {};

var tabs = {
  bookmarks: null,
  'top-sites': null,
  others: null,
};

var has = Object.prototype.hasOwnProperty;

function eachPair(obj, callback) {
  for (var k in obj) {
    if (has.call(obj, k)) {
      callback(obj, k, obj[k]);
    }
  }
}

eachPair(tabs, (_obj, k) => {
  tabHandlers[k] = () => {
    localStorage.setItem('last_tab', k);

    eachPair(tabs, (_obj, k2) => {
      ID('show-' + k2).classList.remove('current');
      tabs[k2].style.display = 'none';
    });

    ID('show-' + k).classList.add('current');
    tabs[k].style.display = 'inline-block';
  };
});

function newTabOpener(url) {
  return event => {
    chrome.tabs.create({url});
    window.close();
    if (event) {
      event.preventDefault();
    }
  };
}

listen(window, 'DOMContentLoaded', () => {
  eachPair(tabs, (obj, k) => {
    obj[k] = ID(k);
    listen(ID('show-' + k), 'click', event => {
      event.preventDefault();
      tabHandlers[k]();
    });
  });

  var newTabLinks = [
    ID('edit-bookmarks'),
    ID('go-to-apps'),
    ID('go-to-extensions'),
  ];

  newTabLinks.forEach(link => {
    link.onclick = newTabOpener(link.dataset.href);
  });

  // Restore last focused tab
  var tab = localStorage.getItem('last_tab') || 'bookmarks';
  var fun = tabHandlers[tab];
  if (fun) {
    fun();
  }

  render();

  var throttledRender = throttle(200, render);

  // Re-render on all bookmarks update events
  Object.keys(chrome.bookmarks)
    .filter(name => name.indexOf('on') === 0)
    .forEach(name => {
      chrome.bookmarks[name].addListener(throttledRender);
    });
});
