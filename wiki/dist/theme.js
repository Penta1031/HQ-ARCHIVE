// The wiki uses a fixed dark appearance, including for previously saved light preferences.
(()=>{
 document.documentElement.dataset.theme='dark';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#09090b');
 try{localStorage.removeItem('hyeopkwae-wiki-theme');}catch{}
})();
