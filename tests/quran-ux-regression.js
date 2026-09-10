'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve('artifacts/quran');
fs.mkdirSync(output, {recursive:true});

(async()=>{
  const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const context = await browser.newContext({viewport:{width:375,height:812},locale:'ar',timezoneId:'Asia/Aden',hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('https://**',r=>r.abort());
    await context.addInitScript(()=>{
      if (!localStorage.getItem('mishkat.settings.v1')) localStorage.setItem('mishkat.settings.v1',JSON.stringify({onboardingSeen:true,notificationPromptSeen:true,theme:'light'}));
      // Deterministic media transport: no real recitation/network in browser QA.
      window.Audio = class extends EventTarget {
        constructor(){super();this.currentTime=0;this.duration=60;this.ended=false;this.src='';window.testQuranAudio=this;}
        load(){this.currentSrc=this.src;queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));}
        play(){this.dispatchEvent(new Event('playing'));return Promise.resolve();}
        pause(){this.dispatchEvent(new Event('pause'));}
      };
    });
    const p = await context.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    const shot=async(name)=>{await p.locator('#toast:not(.show)').waitFor();await p.screenshot({path:path.join(output,name+'.png')});};
    const pageReady=async(n)=>{await p.waitForFunction(n=>Quran.currentPage===n,n);await p.locator(`.mushaf-svg[data-page="${n}"]`).waitFor();};
    await p.goto('http://127.0.0.1:8777/index.html#quran');await p.locator('#splash').waitFor({state:'detached'});
    await shot('index-first-light');
    await p.locator('#quranSeg [data-mode="juz"]').click();
    await p.locator('#surahSearch').fill('الرحمن');
    assert.ok(await p.locator('#searchResults [data-surah="55"]').count()>=1);
    await shot('search-light');
    await p.locator('#btnClearQuranSearch').click();
    assert.equal(await p.locator('#juzList').isVisible(),true);
    assert.equal(await p.locator('#surahList').isVisible(),false);
    assert.equal(await p.locator('#marksList').isVisible(),false);
    await p.locator('#surahSearch').fill('٢');
    assert.equal(await p.locator('#searchResults [data-surah="2"]').count(),1,'Single Arabic digit searches surah number');
    await p.locator('#surahSearch').fill('البقره');
    assert.equal(await p.locator('#searchResults [data-surah="2"]').count(),1);
    await p.locator('#btnClearQuranSearch').click();
    await p.locator('#quranSeg [data-mode="surah"]').click();
    await p.locator('#surahList [data-surah="36"]').scrollIntoViewIfNeeded();
    const indexScroll=await p.locator('#app').evaluate(e=>e.scrollTop);
    await p.locator('#surahList [data-surah="36"]').click();
    await pageReady(440);
    assert.equal(await p.locator('#player').isVisible(),false,'Audio controls are contextual');
    assert.equal(await p.locator('#topbar').isVisible(),false,'No duplicate app header above reader');
    await p.locator('#btnBackIndex').click();await p.locator('#quranIndex').waitFor({state:'visible'});
    assert.ok(Math.abs(await p.locator('#app').evaluate(e=>e.scrollTop)-indexScroll)<3,'Index scroll restored');
    assert.equal(await p.locator('#surahList [data-surah="36"]').evaluate(e=>document.activeElement===e),true);
    await p.locator('.quran-index-jump>summary').click();await p.locator('#indexPageNumber').fill('16');await p.locator('#indexPageForm button').click();
    await pageReady(16);await shot('reader-light');
    await p.locator('#btnReaderBookmark').click();
    assert.equal(await p.locator('#btnReaderBookmark').getAttribute('aria-pressed'),'true');
    const saved=await p.evaluate(()=>Store.s.bookmarks);
    assert.equal(saved.length,1);assert.equal(saved[0].page,16);
    await p.locator('#btnReaderPage').click();
    assert.equal(await p.locator('#readerNavigation').isVisible(),true);
    await p.locator('#gotoValue').fill('262');await p.locator('#readerJumpForm').press('Enter');
    await pageReady(262);assert.equal(await p.locator('#readerReturn').isVisible(),true);
    await p.locator('#btnReaderReturn').click();await pageReady(16);
    assert.equal(await p.locator('#readerReturn').isVisible(),false);
    await p.locator('#btnReaderAudio').click();await p.locator('#btnPlay').click();
    await p.waitForFunction(()=>document.querySelector('#player').dataset.state==='playing');
    await p.locator('#btnReciterOptions').click();await p.locator('#reciterSel').selectOption({index:1});
    const reciter=await p.locator('#reciterSel option:checked').textContent();
    assert.equal(await p.locator('#playerReciter').textContent(),reciter);
    await p.locator('#btnCloseReaderTools').click();
    assert.equal(await p.locator('#btnReciterOptions').evaluate(e=>document.activeElement===e),true);
    await shot('audio-light');
    await p.locator('#btnFollowingPage').click();await pageReady(17);
    assert.equal(await p.locator('#btnPlay').getAttribute('aria-label'),'تشغيل التلاوة','Manual navigation pauses mismatched recitation');
    await p.locator('#btnReaderAudio').click();
    await p.locator('#btnReaderMenu').click();
    assert.equal(await p.locator('#readerAppearance').isVisible(),true);
    await p.locator('#app').evaluate(e=>e.dispatchEvent(new FocusEvent('focusin',{bubbles:true})));
    assert.equal(await p.locator('#readerTools').isVisible(),true,'WebKit main-container focus must not cancel a tap in the tools');
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('#readerTools').isVisible(),false,'Escape closes freshly opened tab panel');
    await p.locator('#btnReaderMenu').click();
    await p.locator('#readerFontRange').focus();await p.keyboard.press('End');
    await p.waitForFunction(()=>document.querySelector('.mushaf-page-paper').getBoundingClientRect().width/document.querySelector('.mushaf-page-viewport').clientWidth>1.64);
    await shot('zoom-light');
    await p.locator('[data-reader-size="32"]').click();await p.keyboard.press('Escape');
    await p.locator('#btnBackIndex').click();await p.locator('#quranIndex').waitFor({state:'visible'});
    await p.locator('#quranSeg [data-mode="marks"]').click();
    await p.locator('#marksList [data-del]').focus();await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(()=>Store.s.bookmarks.length),0);
    await p.locator('[data-undo-mark]').click();
    assert.deepEqual(await p.evaluate(()=>Store.s.bookmarks),saved);
    await shot('bookmarks-light');
    await p.locator('#marksList [data-surah]').click();await pageReady(16);
    await p.evaluate(()=>{document.documentElement.style.setProperty('--safe-t','62px');document.querySelector('#app').scrollTop=150;});
    await p.waitForFunction(()=>document.querySelector('#app').getBoundingClientRect().top===62,null,{timeout:3000});
    const safeHeader=await p.locator('#quranReader .reader-bar').evaluate(e=>({y:e.getBoundingClientRect().y,top:getComputedStyle(e).top,safe:getComputedStyle(e).getPropertyValue('--safe-t')}));
    assert.ok(safeHeader.y>=62 && safeHeader.y<80,'Reader toolbar stays below the notch without a duplicate inset '+JSON.stringify(safeHeader));
    await context.setOffline(true);
    await p.waitForFunction(()=>document.body.classList.contains('is-offline'));
    await p.waitForFunction(()=>document.querySelector('#app').getBoundingClientRect().top===106);
    assert.ok((await p.locator('#quranReader .reader-bar').boundingBox()).y>=106,'Offline banner and notch do not cover the reader toolbar');
    await context.setOffline(false);
    await p.waitForFunction(()=>!document.body.classList.contains('is-offline'));
    await p.evaluate(()=>{document.documentElement.style.removeProperty('--safe-t');document.querySelector('#app').scrollTop=0;});

    // Touch starts over an actual verse region, not a blank page margin.
    const cdp=await context.newCDPSession(p);
    const touch=await p.evaluate(()=>{
      for(let y=180;y<450;y+=10) for(let x=60;x<145;x+=5) if(document.elementFromPoint(x,y)?.matches('.ayahPolygon')) return {x,y};
      return null;
    });
    assert.ok(touch,'Visible verse hit target found');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
    for(let dx=20;dx<=100;dx+=20) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x+dx,y:touch.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await pageReady(17);
    assert.equal(await p.locator('#ayahSheet').count(),0,'Swipe does not also open verse actions');
    await p.locator('.ayahPolygon').first().focus();await p.keyboard.press('Enter');
    await p.locator('#ayahSheet').waitFor();
    await p.waitForFunction(()=>document.querySelector('#ayahSheet').contains(document.activeElement));
    assert.equal(await p.locator('#app').getAttribute('inert'),'');
    await p.keyboard.press('Escape');await p.locator('#ayahSheet').waitFor({state:'detached'});
    console.log('✓ Search/clear/single digits, index scroll/focus, jump/return, mark/undo, contextual audio, reader settings, native browser touch over verses');

    for (const theme of ['light','dark']) {
      await p.locator('#btnReaderMenu').click();await p.locator('#readerThemeSel').selectOption(theme);await p.locator('#btnCloseReaderTools').click();
      for (const [width,height] of [[320,740],[375,812],[430,932],[768,1024],[812,375]]) {
        await p.setViewportSize({width,height});
        assert.ok(await p.locator('#view-quran').evaluate(e=>e.scrollWidth-e.clientWidth)<2,`${theme} ${width} no overflow`);
        const dock=await p.locator('#readerDock').boundingBox(),bar=await p.locator('#tabbar').boundingBox();
        assert.ok(dock.y+dock.height<=bar.y+1,'Page dock clears tab bar');
        const small=await p.locator('#quranReader button:visible').evaluateAll(xs=>xs.filter(e=>{const r=e.getBoundingClientRect();return r.width<43.5||r.height<43.5;}).map(e=>e.id));
        assert.deepEqual(small,[],'Reader controls 44px');
        await shot(`reader-${theme}-${width}`);
      }
    }
    await p.setViewportSize({width:375,height:812});
    await p.locator('#btnReaderAudio').click();
    await p.locator('#btnReciterOptions').click();
    await p.setViewportSize({width:812,height:375});
    assert.ok((await p.locator('#readerTools').boundingBox()).height>=150,'Audio options remain usable in landscape');
    await p.locator('#reciterSel').scrollIntoViewIfNeeded();
    await shot('audio-settings-landscape');
    await p.keyboard.press('Escape');await p.locator('#btnReaderAudio').click();
    await p.setViewportSize({width:375,height:812});
    await p.locator('#btnReaderFocus').click();await shot('focus-dark');
    await p.keyboard.press('Escape');assert.equal(await p.locator('#tabbar').isVisible(),true);
    await p.locator('#btnReaderMenu').click();await p.locator('[data-reader-panel="navigation"]').click();await p.locator('#gotoValue').fill('604');await p.locator('#btnGoLocation').click();await pageReady(604);
    assert.equal(await p.locator('#btnFollowingPage').isEnabled(),false);
    await p.locator('#btnReaderPage').click();await p.locator('#gotoValue').fill('1');await p.locator('#btnGoLocation').click();await pageReady(1);
    assert.equal(await p.locator('#btnPreviousPage').isEnabled(),false);
    await p.evaluate(()=>document.documentElement.style.setProperty('font-size','32px','important'));
    await p.waitForFunction(()=>getComputedStyle(document.documentElement).fontSize==='32px');
    assert.ok(await p.locator('#view-quran').evaluate(e=>e.scrollWidth-e.clientWidth)<2,'200% text does not overflow');
    await shot('large-text');
    await p.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    assert.deepEqual(await p.evaluate(()=>Store.s.bookmarks),saved,'Bookmarks survive reload');
    await p.locator('#lastReadBox button').click();await pageReady(1);
    assert.deepEqual(errors,[]);
    console.log('✓ 320/375/430/768/landscape, light/dark, focus escape, first/last page bounds, 200% text, no runtime errors');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
