try{new BroadcastChannel('action-tools-browser-session-refresh').postMessage({type:'session-refresh'});}catch{}
window.close();
