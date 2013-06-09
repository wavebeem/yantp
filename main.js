function appendText(elem, text) {
    elem.appendChild(document.createTextNode(text));
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

function generate(node, path) {
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
        // appendText(elem, node.title);
        elem.appendChild(title(node.title));
        elem.href = node.url;
    }
    else if (node.children) {
        elem = document.createElement("div");
        elem.className = "node folder";
        // elem.appendChild(header(2, node.title));
        node.children.forEach(function(child) {
            elem.appendChild(generate(child, path.concat(node.title)));
        });
    }

    return elem;
}

function render() {
    if (! bookmarks) return;

    bookmarks.innerHTML = "";
    chrome.bookmarks.getSubTree("1", function(nodes) {
        nodes[0].children.forEach(function(node) {
            var bookmark = generate(node);
            bookmarks.appendChild(bookmark);
        });
    });
}

var bookmarks;

addEventListener("DOMContentLoaded", function(event) {
    bookmarks = document.getElementById("bookmarks");
    document.getElementById("edit-bookmarks").onclick = function(event) {
        chrome.tabs.create({ url: "chrome://bookmarks" });
    };
    render();
    var events = chrome.bookmarks;
    for (var name in events) {
        if (name.indexOf("on") === 0) {
            events[name].addListener(render);
        }
    }
}, false);
