var global = this;

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
    var elem = document.createElement("span");
    var backgroundImage = "-webkit-image-set(" + [
        "url(chrome://favicon/size/16@1x/" + url + ") 1x",
        "url(chrome://favicon/size/16@2x/" + url + ") 2x"
    ].join(", ") + ")";
    elem.style.backgroundImage = backgroundImage;
    elem.className = "image";
    return elem;
}

function favicon(url) {
    var elem  = document.createElement("span");
    var image = img(url);
    elem.className = "favicon";
    elem.appendChild(image);
    return elem;
}

function link(title, url) {
    var elem = document.createElement("a");
    elem.href = url;
    elem.appendChild(favicon(url));
    appendText(elem, title);
    return elem;
}

function title(title) {
    var elem = document.createElement("span");
    elem.className = "title";
    appendText(elem, title);
    return elem;
}

function walkBookmarks(node, callback, path) {
    var elem;
    var pathText;

    if (! node) return;

    if (node.url) {
        callback(node, path);
    }
    else if (node.children) {
        node.children.forEach(function(child) {
            walkBookmarks(child, callback, (path || []).concat(node.title));
        });
    }
    else {
        throw new Error("What kind of bookmark node is this?");
    }
}

function generatePath(path) {
    var elem = document.createElement("span");
    elem.className = "path";

    path.forEach(function(chunk, i) {
        var chunkElem = document.createElement("span");
        var sepElem   = document.createElement("span");

        chunkElem.className = "chunk";
        sepElem  .className = "separator";

        appendText(chunkElem, chunk);
        appendText(sepElem,   " / ");

        elem.appendChild(chunkElem);
        elem.appendChild(sepElem);
    });

    return elem;
}

function generateLink(site, path) {
    var elem;

    elem = document.createElement("a");
    elem.className = "node top-site";
    elem.appendChild(favicon(site.url));
    if (path) {
        elem.appendChild(generatePath(path));
    }
    elem.appendChild(title(site.title));
    elem.href = site.url;

    return elem;
}

function render() {
    if (! tabs["top-sites"]) return;
    if (! tabs["bookmarks"]) return;
    if (! tabs["others"   ]) return;

    tabs["top-sites"].innerHTML = "";
    chrome.topSites.get(function(sites) {
        sites.forEach(function(site) {
            tabs["top-sites"].appendChild(generateLink(site));
        });
    });

    renderBookmarksSubtreeByIdInto("1", tabs["bookmarks"]);
    renderBookmarksSubtreeByIdInto("2", tabs["others"]);
}

function emptyMessage() {
    var elem = document.createElement("p");
    elem.className = "empty-message";
    elem.appendChild(document.createTextNode(
        "This is where bookmarks would go, if you had any"
    ));
    return elem;
}

function renderBookmarksSubtreeByIdInto(bookmarkId, rootElem) {
    rootElem.innerHTML = "";
    chrome.bookmarks.getSubTree(bookmarkId, function(nodes) {
        if (nodes[0].children.length === 0) {
            rootElem.appendChild(emptyMessage());
        }
        else {
            nodes[0].children.forEach(function(node) {
                walkBookmarks(node, function(bookmark, path) {
                    var elem = generateLink(bookmark, path);
                    rootElem.appendChild(elem);
                });
            });
        }
    });
    dirty = false;
}

var bookmarkIds = {
    all: "2",
    bar: "1",
}

var tabHandlers = {};

var tabs = {
    "bookmarks" : null,
    "top-sites" : null,
    "others"    : null,
};

var has = Object.prototype.hasOwnProperty;

var eachPair = function(obj, callback) {
    for (var k in obj) {
        if (has.call(obj, k)) {
            callback.call(obj, k, obj[k]);
        }
    }
};

eachPair(tabs, function(k, v) {
    tabHandlers[k] = function() {
        localStorage.last_tab = k;

        eachPair(tabs, function(k2, v2) {
            ID("show-" + k2).classList.remove("current");
            tabs[k2].style.display = "none";
        });

        ID("show-" + k).classList.add("current");
        tabs[k].style.display = "inline-block";
    };
});

function newTabOpener(url) {
    return function(event) {
        chrome.tabs.create({ url: url });
        global.close();
        if (event) event.preventDefault();
    };
}

var dirty = false;

localStorage.last_tab = localStorage.last_tab || "bookmarks";

listen(window, "DOMContentLoaded", function(event) {
    eachPair(tabs, function(k, v) {
        this[k] = ID(k);
        listen(ID("show-" + k), "click", function(event) {
            event.preventDefault();
            tabHandlers[k]();
        });
    });

    var newTabLinks = [
        ID("edit-bookmarks"),
        ID("go-to-apps"),
        ID("go-to-extensions"),
    ];

    newTabLinks.forEach(function(link) {
        link.onclick = newTabOpener(link.href);
    });

    // Restore last focused tab
    var tab = localStorage.last_tab || "bookmarks";
    var fun = tabHandlers[tab];
    if (fun) fun();

    render();

    // Re-render on all bookmarks update events
    var events = chrome.bookmarks;
    for (var name in events) {
        if (name.indexOf("on") === 0) {
            events[name].addListener(function() {
                dirty = true;
            });
        }
    }

    listen(window, "focus", function(event) {
        if (dirty) {
            render();
        }
    });
});
