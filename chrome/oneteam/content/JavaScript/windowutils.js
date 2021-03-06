var EXPORTED_SYMBOLS = ["windowsObserver", "getWindowWithType", "openDialogUniq",
                        "iterateWindowsWithType"];

function WindowsObserver() {
    CallbacksList.call(this, false, this, this);
    this._windows = [];
    this._tabs = [];
}
_DECL_(WindowsObserver, null, CallbacksList).prototype = {
    registerObserver: function(callback, token) {
        token = this._registerCallback(callback, token);

        try {
            for (var i = 0; i < this._windows.length; i++)
                callback.onWindowAdded(this._windows[i], i);
        } catch (ex) {dump(ex) }

        try {
            for (var i = 0; i < this._tabs.length; i++)
                callback.onChatpaneAdded(this._tabs[i], i);
        } catch (ex) {dump(ex) }

        return token;
    },

    _onWindowLoaded: function(w, dontNotify) {
        w = w.QueryInterface(Components.interfaces.nsIDOMWindow);

        var i = bsearchEx(this._windows, 0, this._windows.length-1, w.document.title.toLowerCase(),
                    function(v, c, i) {
                        return v.localeCompare(c[i].document.title.toLowerCase());
                    });
        this._windows.splice(i, 0, w);

        if (!dontNotify)
            for (var c in this._iterateCallbacks())
                try {
                    c.onWindowAdded(w, i);
                } catch (ex) {dump(ex) }
    },

    onWindowTitleChange: function(win, title) {
        chromeWin = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
            getInterface(Components.interfaces.nsIDOMWindowInternal);

        this.onCloseWindow(win);
        this._onWindowLoaded(chromeWin);
    },

    onOpenWindow: function(win) {
/*        win = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
            getInterface(Components.interfaces.nsIDOMWindowInternal);

        this._onWindowLoaded(win);*/
    },

    onCloseWindow: function(win) {
        win = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
            getInterface(Components.interfaces.nsIDOMWindowInternal);

        var i = this._windows.indexOf(win);
        if (i < 0)
            return;
        this._windows.splice(i, 1);

        for (var c in this._iterateCallbacks())
            try {
                c.onWindowRemoved(win, i);
            } catch (ex) {dump(ex) }
    },

    onChatpanesUpdated: function(model, type, data) {
        if (data.added)
            for each (var addedData in data.added) {
                if (!addedData._content)
                    continue;
    
                var idx = bsearchEx(this._tabs, 0, this._tabs.length-1,
                        addedData._thread.contact.visibleName.toLowerCase(),
                        function(v, c, i) {
                            return v.localeCompare(c[i]._thread.contact.
                                                   visibleName.toLowerCase());
                        });
                this._tabs.splice(idx, 0, addedData);
    
                for (var c in this._iterateCallbacks())
                    try {
                        c.onChatpaneAdded(addedData, idx);
                    } catch (ex) {dump("1"+ex) }
            }
    
        if (data.removed)
            for each (var removedData in data.removed) {
                var idx = this._tabs.indexOf(removedData);
                if (idx < 0)
                    continue;
    
                this._tabs.splice(idx, 1);
                for (var c in this._iterateCallbacks())
                    try {
                        c.onChatpaneRemoved(removedData, idx);
                    } catch (ex) { dump(ex) }
            }
    },

    get windowMediator() {
        return META.ACCESSORS.replace(this, "windowMediator",
                Components.classes["@mozilla.org/appshell/window-mediator;1"].
                    getService(Components.interfaces.nsIWindowMediator));
    },

    onStartWatching: function() {
        this.windowMediator.addListener(this);
        this._token = chatTabsController.registerView(this.onChatpanesUpdated,
                                                      this, "_chatpanes");

        var e = this.windowMediator.getEnumerator(null);
        while (e.hasMoreElements())
            this._onWindowLoaded(e.getNext(), true);

        if (chatTabsController._chatpanes.length)
            this.onChatpanesUpdated(chatTabsController, "_chatpanes",
                                    {added: chatTabsController._chatpanes});
    },

    onStopWatching: function() {
        this.windowMediator.removeListener(this);
        this._token.unregisterFromAll();
        this._windows = [];
        this._tabs = [];
    }
}

var windowsObserver = new WindowsObserver();

function getWindowWithType(type) {
    return windowsObserver.windowMediator.getMostRecentWindow(type);
}

function iterateWindowsWithType(type) {
    var e = windowsObserver.windowMediator.getEnumerator(type);
    while (e.hasMoreElements())
        yield e.getNext();
}

var openingWindows = {};
function openDialogUniq(type, url, flags)
{
    var win;

    if (type) {
        win = getWindowWithType(type);
        if (!win)
            win = openingWindows[type];
    }

    if (!win) {
        var args = [url, "_blank"].concat(Array.slice(arguments, 2));
        win = window.openDialog.apply(window, args);
        if (type) {
            openingWindows[type] = win;
            setTimeout(function(type) {
                delete openingWindows[type];
            }, 1000, type);
        }

        return win;
    }

    if (!/\balwaysLowered\b/.exec(flags))
        win.focus();

    return win;
}
