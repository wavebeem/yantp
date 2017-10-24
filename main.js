const isFirefox = /Firefox\/[^ ]+/.test(navigator.userAgent);
const isChrome = /Chrome\/[^ ]+/.test(navigator.userAgent);

function setBodyClass() {
  let bodyClass = undefined;
  if (isFirefox) {
    bodyClass = "IS_FIREFOX";
  } else if (isChrome) {
    bodyClass = "IS_CHROME";
  } else {
    return;
  }
  document.body.classList.add(bodyClass);
}

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
    if (k === "style") {
      Object.assign(elem.style, props[k]);
    } else {
      elem[k] = props[k];
    }
  });
  children
    .map(asNode)
    .filter(x => x)
    .forEach(kid => {
      elem.appendChild(kid);
    });
  return elem;
}

function asNode(x) {
  if (typeof x === "string") {
    return document.createTextNode(x);
  } else {
    return x;
  }
}

function faviconUrl(url) {
  if (isChrome) {
    return `
      -webkit-image-set(
        url(chrome://favicon/size/16@1x/${url}) 1x,
        url(chrome://favicon/size/16@2x/${url}) 2x)
    `;
  } else if (isFirefox) {
    const parsedUrl = new URL(url);
    parsedUrl.pathname = "favicon.ico";
    console.log(parsedUrl.href);
    return parsedUrl.href;
  }
}

function img(url) {
  if (isChrome) {
    const opts = {
      className: "FaviconImage",
      style: { backgroundImage: faviconUrl(url) }
    };
    return E("span", opts, []);
  } else if (isFirefox) {
    return E("img", { className: "FaviconImage", src: faviconUrl(url) }, []);
  }
}

function favicon(url) {
  return E("span", { className: "Favicon va-middle" }, [img(url)]);
}

function title(title) {
  return E("span", { className: "va-middle" }, [title]);
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
    throw new Error("What kind of bookmark node is this?");
  }
}

function generatePath(path) {
  const twins = path.map(chunk => [
    E("span", { className: "gray" }, [chunk]),
    E("span", { className: "light-gray" }, [" / "])
  ]);
  const kids = twins.reduce((a, b) => a.concat(b));
  return E("span", { className: "va-middle" }, kids);
}

function generateLink(site, path) {
  const kids = [
    isChrome ? favicon(site.url) : undefined,
    path ? generatePath(path) : undefined,
    title(site.title || site.url)
  ];
  return E("a", { className: "Bookmark db reset-link", href: site.url }, kids);
}

function bookmarksBarId() {
  if (isFirefox) {
    return "toolbar_____";
    // return "menu________";
  } else if (isChrome) {
    return "1";
  }
}

function bookmarksOtherId() {
  if (isFirefox) {
    return "unfiled_____";
  } else if (isChrome) {
    return "2";
  }
}

function render() {
  if (!tabs["top-sites"] || !tabs.bookmarks || !tabs.others) {
    return;
  }
  tabs["top-sites"].innerHTML = "";
  chrome.topSites.get(sites => {
    sites.forEach(site => {
      tabs["top-sites"].appendChild(generateLink(site));
    });
  });
  renderBookmarksSubtreeByIdInto(bookmarksBarId(), tabs.bookmarks);
  renderBookmarksSubtreeByIdInto(bookmarksOtherId(), tabs.others);
}

function emptyMessage() {
  return E("p", { className: "tc gray" }, [
    "This is where bookmarks would go, if you had any"
  ]);
}

function renderBookmarksSubtreeByIdInto(bookmarkId, rootElem) {
  rootElem.innerHTML = "";
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
  bookmarks: undefined,
  "top-sites": undefined,
  others: undefined
};

function eachPair(obj, callback) {
  Object.keys(obj).forEach(k => callback(obj, k, obj[k]));
}

eachPair(tabs, (_obj, k) => {
  tabHandlers[k] = () => {
    localStorage.setItem("last_tab", k);
    eachPair(tabs, (_obj, k2) => {
      ID("show-" + k2).classList.remove("is-current");
      tabs[k2].style.display = "none";
    });
    ID("show-" + k).classList.add("is-current");
    tabs[k].style.display = "";
  };
});

function newTabOpener(url) {
  return event => {
    chrome.tabs.create({ url });
    window.close();
    if (event) {
      event.preventDefault();
    }
  };
}

listen(window, "DOMContentLoaded", () => {
  setBodyClass();
  eachPair(tabs, (obj, k) => {
    obj[k] = ID(k);
    listen(ID("show-" + k), "click", event => {
      event.preventDefault();
      tabHandlers[k]();
    });
  });
  const newTabLinks = [
    ID("edit-bookmarks"),
    ID("go-to-apps"),
    ID("go-to-extensions")
  ];
  newTabLinks.forEach(link => {
    link.onclick = newTabOpener(link.dataset.href);
  });
  // Restore last focused tab
  const tab = localStorage.getItem("last_tab") || "bookmarks";
  const fun = tabHandlers[tab];
  if (fun) {
    fun();
  }
  render();
  const throttledRender = throttle(200, render);
  // Re-render on all bookmarks update events
  Object.keys(chrome.bookmarks)
    .filter(name => name.indexOf("on") === 0)
    .forEach(name => {
      chrome.bookmarks[name].addListener(throttledRender);
    });
});
