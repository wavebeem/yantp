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

function ID(id) {
  return document.getElementById(id);
}

function listen(obj, name, cb, capture) {
  obj.addEventListener(name, cb, !!capture);
}

function E(type, props, children) {
  props = props || {};
  children = children || [];
  const elem = document.createElement(type);
  Object.keys(props).forEach(k => {
    if (k === 'style') {
      Object.assign(elem.style, props[k]);
    } else {
      elem[k] = props[k];
    }
  });
  children
    .map(asNode)
    .filter(x => x !== null)
    .forEach(kid => {
      elem.appendChild(kid);
    });
  return elem;
}

function asNode(x) {
  if (typeof x === 'string') {
    return document.createTextNode(x);
  } else {
    return x;
  }
}

function faviconImageSet(url) {
  return `
    -webkit-image-set(
      url(chrome://favicon/size/16@1x/${url}) 1x,
      url(chrome://favicon/size/16@2x/${url}) 2x)
  `;
}

function img(url) {
  return E('span', {
    className: 'image',
    style: {backgroundImage: faviconImageSet(url)}
  }, []);
}

function favicon(url) {
  return E('span', {className: 'favicon'}, [img(url)]);
}

function title(title) {
  return E('span', {className: 'title'}, [title]);
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
  const twins = path.map(chunk => [
    E('span', {className: 'chunk'}, [chunk]),
    E('span', {className: 'separator'}, [' / '])
  ]);
  const kids = twins.reduce((a, b) => a.concat(b));
  return E('span', {className: 'path'}, kids);
}

function generateLink(site, path) {
  const kids = [
    favicon(site.url),
    path ? generatePath(path) : null,
    title(site.title)
  ];
  return E('a', {className: 'node', href: site.url}, kids);
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
  return E('p', {className: 'empty-message'}, [
    'This is where bookmarks would go, if you had any'
  ]);
}

function renderBookmarksSubtreeByIdInto(bookmarkId, rootElem) {
  rootElem.innerHTML = '';
  chrome.bookmarks.getSubTree(bookmarkId, nodes => {
    if (nodes[0].children.length === 0) {
      rootElem.appendChild(emptyMessage());
    } else {
      nodes[0].children.forEach(node => {
        walkBookmarks(node, (bookmark, path) => {
          const elem = generateLink(bookmark, path);
          rootElem.appendChild(elem);
        });
      });
    }
  });
}

const tabHandlers = {};

const tabs = {
  bookmarks: null,
  'top-sites': null,
  others: null,
};

function eachPair(obj, callback) {
  Object.keys(obj).forEach(k => callback(obj, k, obj[k]));
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
  const newTabLinks = [
    ID('edit-bookmarks'),
    ID('go-to-apps'),
    ID('go-to-extensions'),
  ];
  newTabLinks.forEach(link => {
    link.onclick = newTabOpener(link.dataset.href);
  });
  // Restore last focused tab
  const tab = localStorage.getItem('last_tab') || 'bookmarks';
  const fun = tabHandlers[tab];
  if (fun) {
    fun();
  }
  render();
  const throttledRender = throttle(200, render);
  // Re-render on all bookmarks update events
  Object.keys(chrome.bookmarks)
    .filter(name => name.indexOf('on') === 0)
    .forEach(name => {
      chrome.bookmarks[name].addListener(throttledRender);
    });
});
