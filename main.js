function appendText(elem, text) {
    elem.appendChild(document.createTextNode(text));
}

function ID(id) {
    return document.getElementById(id);
}

function img(src) {
    var elem = document.createElement("img");
    elem.src = src;
    elem.className = "favicon";
    return elem;
}

function favicon(url) {
    var elem = img("chrome://favicon/" + url);
    elem.width  = 16;
    elem.height = 16;
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

function generateBookmarkOrFolder(node, path) {
    path = path || [];
    var elem;
    var pathText;

    if (node.url) {
        elem = document.createElement("a");
        elem.className = "node bookmark";
        elem.appendChild(favicon(node.url));
        if (path.length > 0) {
            pathText = path.join(" / ") + " / ";
            appendText(elem, pathText);
        }
        else {
            elem.classList.add("top-level");
        }
        // appendtext(elem, node.title);
        elem.appendChild(title(node.title));
        elem.href = node.url;
    }
    else if (node.children) {
        elem = document.createElement("div");
        elem.className = "node folder";
        // elem.appendChild(header(2, node.title));
        node.children.forEach(function(child) {
            elem.appendChild(generateBookmarkOrFolder(child, path.concat(node.title)));
        });
    }

    return elem;
}

function generateTopSite(site) {
    var elem;

    elem = document.createElement("a");
    elem.className = "node top-site";
    elem.appendChild(favicon(site.url));
    elem.appendChild(title(site.title));
    elem.href = site.url;

    return elem;
}

function render() {
    if (! bookmarks) return;
    if (! topSites)  return;

    topSites.innerHTML = "";
    chrome.topSites.get(function(sites) {
        sites.forEach(function(site) {
            topSites.appendChild(generateTopSite(site));
        });
    });

    bookmarks.innerHTML = "";
    chrome.bookmarks.getSubTree("1", function(nodes) {
        nodes[0].children.forEach(function(node) {
            var bookmark = generateBookmarkOrFolder(node);
            bookmarks.appendChild(bookmark);
        });
    });
}

var tabHandlers = {
    "bookmarks": function() {
        localStorage.last_tab   = "bookmarks";
        bookmarks.style.display = "inline-block";
        topSites .style.display = "none";

        ID("show-bookmarks").classList.add("current");
        ID("show-top-sites").classList.remove("current");
    },

    "top-sites": function() {
        localStorage.last_tab   = "top-sites";
        topSites .style.display = "inline-block";
        bookmarks.style.display = "none";

        ID("show-top-sites").classList.add("current");
        ID("show-bookmarks").classList.remove("current");
    }
};

function editBookmarks() {
    chrome.tabs.create({ url: "chrome://bookmarks" });
}

var bookmarks;
var topSites;

addEventListener("DOMContentLoaded", function(event) {
    bookmarks = ID("bookmarks");
    topSites  = ID("top-sites");

    ID("edit-bookmarks").onclick = editBookmarks;
    ID("show-bookmarks").onclick = tabHandlers["bookmarks"];
    ID("show-top-sites").onclick = tabHandlers["top-sites"];

    // Restore last focused tab
    var tab = localStorage.last_tab;
    var fun = tabHandlers[tab];
    if (fun) fun();

    render();

    // Re-render on all bookmarks update events
    var events = chrome.bookmarks;
    for (var name in events) {
        if (name.indexOf("on") === 0) {
            events[name].addListener(render);
        }
    }
}, false);
