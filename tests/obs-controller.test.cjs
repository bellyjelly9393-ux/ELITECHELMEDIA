const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(clipboardFails=false){
 const elements={};
 for(const id of ['controllerAppearance','controllerLiveFrame','controllerPanel','controllerBackground','controllerAccent','controllerSourceUrl','controllerPreview','controllerOpen','controllerCopyStatus','controllerPreviewStatus','controllerLoad','controllerGold','controllerExample','controllerCopy'])elements[id]={value:'',dataset:{},style:{setProperty(){}},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},focus(){this.focused=true;},select(){this.selected=true;}};
 elements.controllerBackground.value='transparent';elements.controllerAccent.value='#d9a63b';
 let copied;
 vm.runInNewContext(fs.readFileSync('obs-controller.js','utf8'),{document:{getElementById:id=>elements[id]},URL,navigator:{clipboard:{async writeText(value){if(clipboardFails)throw Error('denied');copied=value;}}}});
 return {e:elements,click:id=>elements[id].listeners.click(),copied:()=>copied};
}
test('transparent Xbox URL is configured without loading an external page',()=>{
 const {e}=setup();
 assert.equal(e.controllerSourceUrl.value,'https://keymap.io/overlay/?style=xbox&accent=d9a63b');
 assert.equal(e.controllerPreview.src,undefined);
 assert.equal(e.controllerOpen.href,e.controllerSourceUrl.value);
});
test('example recreates supplied URL; gold resets to transparent; loaded preview follows changes',()=>{
 const {e,click}=setup();click('controllerExample');
 assert.equal(e.controllerSourceUrl.value,'https://keymap.io/overlay/?style=xbox&bg=green&accent=ff3d6e');
 click('controllerLoad');assert.equal(e.controllerPreview.src,e.controllerSourceUrl.value);
 click('controllerGold');assert.equal(e.controllerPreview.src,'https://keymap.io/overlay/?style=xbox&accent=d9a63b');
 assert.match(e.controllerPreviewStatus.textContent,/does not confirm input capture/);
});
test('dark background and invalid colours are handled safely',()=>{
 const {e}=setup();e.controllerBackground.value='dark';e.controllerAccent.value='javascript:bad';e.controllerBackground.listeners.change();
 assert.equal(e.controllerSourceUrl.value,'https://keymap.io/overlay/?style=xbox&bg=dark&accent=d9a63b');
});
test('copy reports success only after clipboard write and supports denied clipboard',async()=>{
 let s=setup();await s.click('controllerCopy');assert.equal(s.copied(),s.e.controllerSourceUrl.value);assert.match(s.e.controllerCopyStatus.textContent,/copied/);
 s=setup(true);await s.click('controllerCopy');assert.equal(s.e.controllerSourceUrl.selected,true);assert.match(s.e.controllerCopyStatus.textContent,/manually/);
});
test('panel stays inside existing management gate and includes input limits',()=>{
 const html=fs.readFileSync('obs-control.html','utf8').replace(/\r\n/g,'\n');
 assert.ok(html.indexOf('data-management-content hidden')<html.indexOf('id="controllerPanel"'));
 assert.ok(html.indexOf('id="controllerPanel"')<html.lastIndexOf('  </div>\n</main>'));
 assert.match(html,/connected only to your console cannot send inputs/);
 assert.match(html,/allow="gamepad"/);
});

