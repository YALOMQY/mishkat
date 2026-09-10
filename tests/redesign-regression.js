'use strict';

// Actual browser interaction against localhost, isolated from user data/services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve('artifacts/redesign');
fs.mkdirSync(output,{recursive:true});

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar',timezoneId:'Asia/Aden',reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('https://**',r=>r.abort());
    await context.addInitScript(()=>{
      if(!localStorage.getItem('mishkat.settings.v1')) localStorage.setItem('mishkat.settings.v1',JSON.stringify({lat:14.7664,lng:49.6254,city:'الشحر، حضرموت',onboardingSeen:true,notificationPromptSeen:true,theme:'light'}));
    });
    const p=await context.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(process.env.MISHKAT_TEST_URL || 'http://127.0.0.1:8777');
    await p.locator('#splash').waitFor({state:'detached'});
    const view=async(name)=>{
      if(await p.locator('body').getAttribute('data-view')!==name) await p.locator(name==='settings'?'#btnSettingsTop':`#tabbar [data-view="${name}"]`).click();
    };
    const shot=async(name)=>{
      await p.locator('#toast:not(.show)').waitFor();
      await p.screenshot({path:path.join(output,name+'.png')});
    };
    await shot('home-light');
    await p.locator('[data-period="evening"]').click();
    assert.match(await p.locator('#adTitle').textContent(),/الصباح والمساء/);
    const count=p.locator('.dcount').first();
    assert.match(await count.getAttribute('aria-label'),/عدّ الذكر/);
    await count.click();
    assert.ok((await count.getAttribute('aria-label')).length>0);
    await shot('adhkar-reading-light');
    await view('home');await p.locator('[data-journey="read"]').click();
    await p.locator('.mushaf-svg').waitFor();
    await p.locator('#btnReaderMenu').click();
    await p.locator('[data-reader-panel="navigation"]').click();
    await p.locator('#gotoValue').fill('16');await p.locator('#btnGoLocation').click();
    await p.waitForFunction(()=>Quran.currentPage===16);
    await p.locator('.mushaf-svg').waitFor();
    await p.locator('#btnReaderFocus').click();
    assert.equal(await p.locator('#tabbar').isVisible(),false);
    assert.equal(await p.locator('#topbar').isVisible(),false);
    assert.equal(await p.locator('#btnReaderFocus').getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('#btnBackIndex').isVisible(),true);
    await shot('mushaf-focus-light');
    await p.locator('#btnReaderMenu').click();
    const toolsTop=(await p.locator('#readerTools').boundingBox()).y;
    const toolsAnchor=await p.evaluate(()=>{
      const r=document.querySelector('.mushaf-page-viewport').getBoundingClientRect();
      const top=Math.max(r.top,document.querySelector('#quranReader .reader-bar').getBoundingClientRect().bottom);
      const bottom=Math.min(r.bottom,document.querySelector('#readerTools').getBoundingClientRect().top);
      const y=(top+bottom)/2;
      return {y,ratio:(y-r.top)/r.height};
    });
    await p.locator('#readerFontRange').focus();await p.keyboard.press('End');
    assert.equal(await p.locator('#readerFontValue').textContent(),'165%');
    await p.waitForFunction(()=>document.querySelector('.mushaf-page-paper').getBoundingClientRect().width/document.querySelector('.mushaf-page-viewport').clientWidth>1.64);
    await p.waitForFunction(()=>{const e=document.querySelector('.mushaf-page-viewport');return Math.abs(e.scrollLeft-(e.scrollWidth-e.clientWidth)/2)<2;});
    assert.ok(Math.abs((await p.locator('#readerTools').boundingBox()).y-toolsTop)<2,'Zoom controls stay in place');
    await p.waitForFunction(({y,ratio})=>{const r=document.querySelector('.mushaf-page-viewport').getBoundingClientRect();return Math.abs(r.top+r.height*ratio-y)<3;},toolsAnchor);
    await shot('mushaf-zoom-light');
    await p.keyboard.press('Home');
    assert.equal(await p.locator('#readerFontValue').textContent(),'82%');
    await p.locator('[data-reader-size="32"]').click();
    await p.locator('#btnCloseReaderTools').click();
    assert.equal(await p.locator('#btnReaderMenu').evaluate(e=>e===document.activeElement),true);
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('#tabbar').isVisible(),true);
    assert.equal(await p.locator('#btnReaderFocus').getAttribute('aria-pressed'),'false');
    await p.locator('#btnBackIndex').click();await p.locator('#quranIndex').waitFor({state:'visible'});
    await view('home');assert.match(await p.locator('#homeReadingMeta').textContent(),/16/);
    await p.locator('[data-journey="read"]').click();
    await p.waitForFunction(()=>Quran.currentPage===16);
    await view('home');await p.locator('#btnPrayerSettings').click();
    assert.equal(await p.locator('#calculationSettings').getAttribute('open'),'');
    assert.equal(await p.locator('#selMethod').isVisible(),true);
    await p.locator('#selTheme').selectOption('dark');
    await view('home');
    await p.waitForFunction(()=>document.querySelector('#app').scrollTop===0);
    await shot('home-dark');
    await p.locator('[data-journey="read"]').click();await p.locator('.mushaf-svg').waitFor();
    await p.locator('#btnReaderFocus').click();await shot('mushaf-focus-dark');
    await p.emulateMedia({reducedMotion:'no-preference'});
    // Presentation-only zoom API is also used by the visible size controls.
    const verticalAnchor = await p.evaluate(()=>{
      const app=document.querySelector('#app'),paper=document.querySelector('.mushaf-page-viewport');
      app.scrollTop=180;
      const rect=paper.getBoundingClientRect();
      const top=Math.max(rect.top,app.getBoundingClientRect().top,document.querySelector('#quranReader .reader-bar').getBoundingClientRect().bottom);
      const bottom=Math.min(rect.bottom,app.getBoundingClientRect().bottom,document.querySelector('#readerDock').getBoundingClientRect().top);
      const y=(top+bottom)/2;
      const ratio=(y-rect.top)/rect.height;
      Quran.setReadingSize(44,{commit:true});
      return {ratio,y};
    });
    await p.waitForFunction(()=>{const p=document.querySelector('.mushaf-page-paper'),v=document.querySelector('.mushaf-page-viewport');return p.getBoundingClientRect().width/v.clientWidth>1.27;});
    await p.waitForTimeout(300); // Wait past the 240ms anchor animation, not just its first frame.
    await p.waitForFunction(({ratio,y})=>{const rect=document.querySelector('.mushaf-page-viewport').getBoundingClientRect();return Math.abs(rect.top+rect.height*ratio-y)<3;},verticalAnchor);
    console.log('✓ Animated zoom expands the actual paper and preserves its visible vertical anchor');
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.evaluate(()=>Quran.setReadingSize(32,{commit:true}));
    await p.locator('#btnBackIndex').click();await p.locator('#quranIndex').waitFor({state:'visible'});
    assert.equal(await p.locator('#tabbar').isVisible(),true);
    console.log('✓ Correct evening shortcut, accessible counter, read/resume, focus exit, keyboard zoom, direct calculation settings');

    await view('library');await p.locator('[data-tools-tab="khatma"]').click();
    const planName='ختمتي مع عائلتي — قراءة هادئة بعد الفجر وقبل النوم';
    await p.locator('[data-khatma-create] .khatma-start-options > summary').click();
    await p.locator('[data-khatma-create] [name="name"]').fill(planName);
    await p.locator('[data-khatma-create] [type="submit"]').click();
    await p.locator('.khatma-module--detail').waitFor();
    await p.locator('[data-khatma-action="advance"][data-pages="5"]').click();
    await view('home');assert.match(await p.locator('#homeKhatmaMeta').textContent(),/5/);
    await p.locator('[data-journey="khatma"]').click();
    assert.equal(await p.locator('.khatma-plan-header h2').textContent(),planName);
    await shot('khatma-dark');
    await p.locator('[data-khatma-action="back"]').click();
    assert.equal(await p.locator('[data-khatma-create]').isVisible(),false);
    await p.locator('.khatma-new > summary').click();
    assert.equal(await p.locator('[data-khatma-create]').isVisible(),true);
    await p.locator('[data-tools-tab="library"]').click();
    await p.locator('[data-library-action="download"]').click();
    await p.locator('.library-book[data-content-state="installed"]').waitFor();
    await p.locator('.library-book__body').click();
    assert.equal(await p.locator('.library-entry').count(),3);
    await p.locator('.library-entry [data-library-action="favorite"]').first().click();
    await shot('library-reading-dark');
    console.log('✓ Existing khatma creation/progress/continue, folded create form, library download/read/favorite');

    // Stress long names and large text without editing any real user state.
    await view('settings');await p.locator('#selUIFont').selectOption('xlarge');
    await p.evaluate(()=>{Store.set('city','الشحر، محافظة حضرموت — موقع محفوظ باسم عربي طويل للمراجعة');});
    await p.setViewportSize({width:320,height:740});
    for(const theme of ['light','dark']) {
      await view('settings');await p.locator('#selTheme').selectOption(theme);
      for(const screen of ['home','qibla','adhkar','library','settings']) {
        await view(screen);
        const overflow=await p.locator('.view.on').evaluate(e=>e.scrollWidth-e.clientWidth);
        assert.ok(overflow<2,`${screen} overflow at 320px, large Arabic`);
        await shot(`${screen}-small-large-text-${theme}`);
      }
    }
    await view('home');
    await p.evaluate(()=>document.documentElement.style.setProperty('font-size','32px','important'));
    await p.waitForFunction(()=>getComputedStyle(document.documentElement).fontSize==='32px',null,{timeout:5000});
    assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).fontSize),'32px');
    assert.ok(await p.locator('.view.on').evaluate(e=>e.scrollWidth-e.clientWidth)<2,'200% text should reflow');
    assert.deepEqual(await p.locator('#tabbar button span').evaluateAll(labels=>labels.filter(e=>e.getBoundingClientRect().width>e.parentElement.getBoundingClientRect().width).map(e=>e.textContent)),[],'Tab labels do not collide at 200%');
    await shot('home-200-percent');
    assert.deepEqual(errors,[]);
    console.log('✓ Small phone, long Arabic, both themes, 200% home text reflow, no runtime errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
