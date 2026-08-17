// LEGACY REDIRECT — kept for browsers that cached the old OneSignalSDKWorker.js.
// FIX: Register a synchronous 'message' listener BEFORE importScripts so Chrome
// does not warn "Event handler of 'message' must be added on initial evaluation".
// This dummy handler is immediately overridden by the real OneSignal SDK handler.
self.addEventListener('message', function() {})

// Now import OneSignal — it will override the dummy handler with its real one.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')
