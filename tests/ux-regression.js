'use strict';

// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
// UI tests use isolated browser profiles and never contact production services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.MISHKAT_TEST_URL || 'http://127.0.0.1:8777';
const screenshots = process.env.MISHKAT_SCREENSHOTS || '/private/tmp/mishkat-ux';
const settings = {lat:14.7664,lng:49.6254,city:'الشحر، حضرموت',onboardingSeen:true,notificationPromptSeen:true};
fs.mkdirSync(screenshots, {recursive:true});

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.MISHKAT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    async function open(overrides={}, native=false, extra={}) {
      const context = await browser.newContext({viewport:{width:375,height:812},locale:'ar',timezoneId:'Asia/Aden',reducedMotion:'reduce',serviceWorkers:'block',...extra});
      await context.route('https://**', route=>route.abort());
      await context.addInitScript(({saved,native}) => {
        if (!localStorage.getItem('mishkat.settings.v1')) localStorage.setItem('mishkat.settings.v1',JSON.stringify(saved));
        if (native) {
          window.__MISHKAT_NATIVE__ = true;
          window.testNative = {authorization:'denied',permissionRequests:0,tests:0,headings:0,locations:0,schedules:[]};
          window.MishkatNative = {
            getPushStatus(){window.dispatchEvent(new CustomEvent('mishkat-push-status',{detail:{authorization:testNative.authorization,configured:true,registered:true}}));},
            requestNotifications(){testNative.permissionRequests++;testNative.authorization='authorized';window.dispatchEvent(new CustomEvent('mishkat-perm',{detail:true}));},
            schedule(list,city,adhan){testNative.schedules.push({list,city,adhan});},
            syncWidget(){},syncDuas(){},testNotification(){testNative.tests++;},
            requestLocation(){testNative.locations++;},startHeading(){testNative.headings++;},stopHeading(){testNative.headings--;}
          };
        }
      },{saved:{...settings,...overrides},native});
      const page = await context.newPage();
      const errors=[];page.on('pageerror', e=>errors.push(e.message));
      return {context,page,errors};
    }
    async function ready(page) {await page.goto(baseURL);await page.locator('#splash').waitFor({state:'detached'});}
    async function view(page,name) {
      if(await page.locator('body').getAttribute('data-view')===name) return;
      if(name==='settings' && await page.locator('#quranReader').isVisible()) await page.locator('#btnBackIndex').click();
      await page.locator(name==='settings'?'#btnSettingsTop':`#tabbar [data-view="${name}"]`).click();
    }
    async function screenshot(page,name) {
      await page.locator('#toast:not(.show)').waitFor();
      await page.screenshot({path:path.join(screenshots,name+'.png')});
    }
    async function checkContrast(page,theme) {
      const results=await page.evaluate(theme=>{
        const style=getComputedStyle(document.documentElement);
        const color=key=>style.getPropertyValue('--'+key).trim();
        const luminance=hex=>{
          const rgb=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
          return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
        };
        return [
          ['text','surface',4.5],['text-secondary','surface-muted',4.5],['primary','surface',4.5],
          ['gold','surface',4.5],['danger','surface',4.5],
          ['on-primary',theme==='dark'?'primary':'primary-strong',4.5],
          ['control-border','surface',3],['control-border','surface-muted',3]
        ].map(([fg,bg,required])=>{
          const a=luminance(color(fg)),b=luminance(color(bg));
          return {pair:fg+'/'+bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),required};
        });
      },theme);
      assert.deepEqual(results.filter(x=>x.ratio<x.required),[],`${theme} design-token contrast`);
      console.log('✓ Contrast '+theme+': '+results.map(x=>x.pair+' '+x.ratio.toFixed(2)).join(', '));
    }

    const basic=await open(); await ready(basic.page);const p=basic.page;
    await p.evaluate(()=>document.documentElement.style.setProperty('--safe-t','62px'));
    assert.ok((await p.locator('.skip-link').boundingBox()).y+(await p.locator('.skip-link').boundingBox()).height<0,'Skip link stays hidden above a notched safe area until focused');
    await p.locator('.skip-link').focus();
    await p.waitForFunction(()=>document.querySelector('.skip-link').getBoundingClientRect().top>=62);
    await p.evaluate(()=>{document.activeElement.blur();document.documentElement.style.removeProperty('--safe-t');});
    assert.equal(await p.locator('[data-bell="fajr"]').getAttribute('aria-pressed'),'false');
    await basic.context.grantPermissions(['notifications']);
    await p.locator('[data-bell="fajr"]').click();
    assert.equal(await p.locator('[data-bell="fajr"]').getAttribute('aria-pressed'),'true');
    assert.equal(await p.evaluate(()=>Store.s.notif),true);
    await view(p,'settings');
    await p.locator('#citySel').selectOption({label:'الشحر، حضرموت'});
    const city=await p.locator('#setLoc').textContent();
    await p.locator('#citySel').selectOption('');
    assert.equal(await p.locator('#setLoc').textContent(),city,'Empty option must not change the city');
    await p.evaluate(()=>window.dispatchEvent(new CustomEvent('mishkat-location',{detail:{lat:21.422,lng:39.826}})));
    assert.equal(await p.locator('#setLoc').textContent(),city,'Late GPS must not replace a manual city');
    await view(p,'quran');
    await p.locator('#surahList [data-surah="1"]').click();
    await p.locator('.mushaf-svg').waitFor();
    assert.equal(await p.locator('#btnTheme path').evaluate(e=>getComputedStyle(e).fill),await p.locator('#btnTheme').evaluate(e=>getComputedStyle(e).color),'Mushaf styling must not leak into app icons');
    await view(p,'adhkar');
    await p.locator('#favStrip [data-cat="0"]').click();
    await p.locator('#btnAddDua').click();
    await p.locator('#duaText').fill('اللهم اغفر لي ولوالديّ');
    await p.locator('#btnSaveDua2').click();
    await p.locator('#duaEditor').waitFor({state:'hidden'});
    assert.equal(await p.locator('#adhkarItems .dtext').textContent(),'اللهم اغفر لي ولوالديّ');
    await p.locator('#btnBackAdhkar').click();
    await p.locator('#adhkarIndex').waitFor({state:'visible'});
    assert.equal(await p.locator('#view-adhkar').getAttribute('class'),'view on');
    await view(p,'home');
    await p.locator('[data-goto="tasbih"]').click();
    for(let i=0;i<3;i++) await p.locator('#counterBtn').click();
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    assert.equal(await p.locator('#counterVal').textContent(),'3','Tasbih session survives relaunch');
    console.log('✓ Notifications, manual location, reader navigation, custom dua, persistent tasbih');

    const native=await open({notif:true},true);await ready(native.page);const n=native.page;
    assert.equal(await n.evaluate(()=>Notify.perm()),'denied','System permission must override saved toggle');
    assert.equal(await n.locator('[data-bell="fajr"]').getAttribute('aria-pressed'),'false');
    assert.equal(await n.evaluate(()=>testNative.locations),0,'Manual location does not request GPS on launch');
    await n.evaluate(()=>Notify.test());
    assert.equal(await n.evaluate(()=>testNative.tests),1,'First test notification also works after granting permission');
    await view(n,'settings');
    assert.match(await n.locator('#offlineState').textContent(),/مرفقة/);
    assert.equal(await n.locator('#btnPrecache').isVisible(),false);
    await view(n,'qibla');
    await n.evaluate(()=>window.__mishkatHeading(null,null));
    assert.equal(await n.locator('#qHeading').textContent(),'—');
    await n.evaluate(()=>window.__mishkatHeading(Qibla.bearing,null,{timestamp:1000,north:'true'}));
    assert.equal(await n.locator('#compass').evaluate(e=>e.classList.contains('aligned')),false);
    assert.match(await n.locator('#qAccuracy').textContent(),/غير معروفة/);
    await n.evaluate(()=>window.__mishkatHeading(Qibla.bearing,3,{timestamp:2000,north:'true'}));
    assert.equal(await n.locator('#compass').evaluate(e=>e.classList.contains('aligned')),true);
    await view(n,'home');
    assert.equal(await n.evaluate(()=>testNative.headings),0);
    await n.evaluate(()=>window.__mishkatHeading(90,3,{timestamp:3000,north:'true'}));
    await view(n,'qibla');
    assert.equal(await n.locator('#qHeading').textContent(),'—','Stale heading is cleared on reentry');
    await view(n,'settings');await n.locator('#swAdhan').uncheck();
    assert.equal(await n.evaluate(()=>testNative.schedules.at(-1).adhan),'none');
    console.log('✓ Native permission reconciliation, silent notifications, compass lifecycle/accuracy, bundled offline state');

    const failure=await open();let fail=true;
    await failure.context.route('**/data/quran.json',r=>fail?r.fulfill({status:503,body:'unavailable'}):r.continue());
    await ready(failure.page);
    await view(failure.page,'quran');
    assert.equal(await failure.page.locator('.content-state').isVisible(),true);
    await view(failure.page,'adhkar');assert.ok(await failure.page.locator('.cat-item').count()>0);
    fail=false;await view(failure.page,'quran');await failure.page.locator('.content-state button').click();
    await failure.page.locator('#quranIndex').waitFor({state:'visible'});
    assert.equal(await failure.page.locator('#surahList [data-surah]').count(),114);
    console.log('✓ Failed Quran load preserves other features and can be retried');

    const firstRun=await open({lat:null,lng:null,city:'',onboardingSeen:false,notificationPromptSeen:false},true,{viewport:{width:320,height:640}});
    const f=firstRun.page;await ready(f);
    await f.locator('#welcomeSheet.show').waitFor();
    assert.equal(await f.locator('#app').evaluate(e=>e.inert),true,'Modal excludes background controls from accessibility navigation');
    const sheetBox=await f.locator('#welcomeSheet .sheet-in').boundingBox();
    assert.ok(Math.abs(sheetBox.y+sheetBox.height-640)<2,'Welcome sheet is anchored to the safe bottom');
    await f.locator('[data-welcome="secondary"]').focus();await f.keyboard.press('Tab');
    assert.equal(await f.locator('[data-welcome="primary"]').evaluate(e=>e===document.activeElement),true,'Keyboard focus stays within the sheet');
    await screenshot(f,'onboarding-320');
    await f.locator('[data-welcome="primary"]').click();
    await f.evaluate(()=>window.dispatchEvent(new CustomEvent('mishkat-location-error',{detail:{reason:'denied'}})));
    await f.locator('#view-settings.on').waitFor();
    assert.match(await f.locator('#locationStatus').textContent(),/اختر مدينتك/);
    await f.locator('#welcomeSheet [data-welcome="secondary"]').waitFor();
    await f.keyboard.press('Escape');
    await f.locator('#welcomeSheet').waitFor({state:'detached'});
    assert.equal(await f.locator('#app').evaluate(e=>e.inert),false);
    await view(f,'qibla');
    await f.locator('#btnQiblaLoc').click();
    await f.evaluate(()=>window.dispatchEvent(new CustomEvent('mishkat-location',{detail:{lat:14.7664,lng:49.6254}})));
    assert.equal(await f.evaluate(()=>testNative.headings),1,'Receiving first location starts the visible native compass');
    await view(f,'settings');await screenshot(f,'location-recovered-320');
    console.log('✓ First launch, bottom sheet keyboard navigation, denied location recovery, automatic compass start');

    for(const width of [320,375,430,768]) for(const theme of ['light','dark']) {
      await p.setViewportSize({width,height:width===768?1024:812});
      await view(p,'settings');await p.locator('#selTheme').selectOption(theme);
      await p.locator('#selUIFont').selectOption(width===320?'xlarge':'normal');
      if(width===375) await checkContrast(p,theme);
      for(const name of ['home','quran','adhkar','qibla','library','settings']) {
        await view(p,name);
        const overflow=await p.locator('.view.on').evaluate(e=>e.scrollWidth-e.clientWidth);
        assert.ok(overflow<2,`${name} overflows ${overflow}px at ${width}/${theme}`);
        await screenshot(p,`${name}-${width}-${theme}`);
      }
      await view(p,'quran');await p.locator('#surahList [data-surah="2"]').click();
      await p.locator('.mushaf-svg').waitFor();
      if (!await p.locator('[data-reader-size="60"]').isVisible()) await p.locator('#btnReaderMenu').click();
      await p.locator('[data-reader-size="60"]').click();
      await p.waitForFunction(()=>{const e=document.querySelector('.mushaf-page-viewport');return Math.abs(e.scrollLeft-(e.scrollWidth-e.clientWidth)/2)<2;});
      assert.ok(await p.locator('.view.on').evaluate(e=>e.scrollWidth-e.clientWidth)<2,'Reader toolbar must fit');
      await p.locator('#btnCloseReaderTools').click();
      await p.locator('#btnReaderAudio').click();
      const small=await p.locator('.player button:visible').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().width<43.5||e.getBoundingClientRect().height<43.5).map(e=>e.id));
      assert.deepEqual(small,[],'Reader controls need 44px targets');
      await screenshot(p,`reader-${width}-${theme}`);
      await p.locator('#btnReaderMenu').click();
      await screenshot(p,`mushaf-${width}-${theme}`);
    }
    await p.setViewportSize({width:812,height:375});await view(p,'qibla');await screenshot(p,'qibla-landscape');
    assert.ok(await p.locator('.view.on').evaluate(e=>e.scrollWidth-e.clientWidth)<2);
    for(const result of [basic,native,failure,firstRun]) assert.deepEqual(result.errors,[],'Uncaught browser errors');
    console.log('✓ Responsive light/dark screens, large Arabic text, 44px reader controls, landscape, no runtime errors');
    console.log('Screenshots:',screenshots);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
