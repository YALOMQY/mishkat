'use strict';

// Uses an isolated browser cache; no production services or user data.
// Start the project on localhost:8777 before running with PLAYWRIGHT_MODULE.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.MISHKAT_TEST_URL || 'http://127.0.0.1:8777';

(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.MISHKAT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const context = await browser.newContext({viewport:{width:375,height:812},locale:'ar',reducedMotion:'reduce'});
    await context.route('https://**', route=>route.abort());
    await context.addInitScript(() => {
      if (!localStorage.getItem('mishkat.settings.v1')) localStorage.setItem('mishkat.settings.v1',JSON.stringify({onboardingSeen:true,notificationPromptSeen:true,lat:14.7664,lng:49.6254,city:'الشحر، حضرموت'}));
    });
    const page = await context.newPage(), errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(baseURL);
    await page.locator('#splash').waitFor({state:'detached'});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.locator('#btnSettingsTop').click();
    await page.locator('#dataSettings > summary').click();
    await page.waitForFunction(()=>document.querySelector('#offlineState').textContent.includes('604'));
    assert.match(await page.locator('#offlineState').textContent(),/0 من 604/);

    await context.setOffline(true);
    await page.locator('#btnPrecache').click();
    await page.waitForFunction(()=>document.querySelector('#offlineState').textContent.includes('لم يكتمل'));
    assert.equal(await page.locator('#btnPrecache').isEnabled(),true);
    console.log('✓ Interrupted download is not reported as complete and offers retry');

    await context.setOffline(false);
    await page.locator('#btnPrecache').click();
    await page.waitForFunction(()=>!document.querySelector('#btnPrecache').disabled && document.querySelector('#offlineState').textContent.startsWith('جاهز'),null,{timeout:180000});
    assert.equal(await page.evaluate(async()=>{
      const cache=await caches.open('mishkat-mushaf-v1');return (await cache.keys()).length;
    }),604);
    console.log('✓ All 604 actual Mushaf pages stored and completion confirmed');

    // Remove one page and verify the retry requests only the missing page.
    await page.evaluate(async()=>{const c=await caches.open('mishkat-mushaf-v1');await c.delete('assets/mushaf/hafs-kfqc/pages/604.svg');});
    const downloaded=[];
    context.on('request',request=>{if(/\/pages\/\d+\.svg$/.test(new URL(request.url()).pathname)) downloaded.push(request.url());});
    await page.locator('#btnPrecache').click();
    await page.waitForFunction(()=>!document.querySelector('#btnPrecache').disabled && document.querySelector('#offlineState').textContent.startsWith('جاهز'),null,{timeout:60000});
    assert.equal(downloaded.length,1,'Resume must reuse already saved pages');
    assert.match(downloaded[0],/604\.svg$/);
    console.log('✓ Retry resumes only the missing page');

    await context.setOffline(true);
    await page.reload();await page.locator('#splash').waitFor({state:'detached'});
    await page.locator('#tabbar [data-view="quran"]').click();
    await page.evaluate(()=>Quran.openPage(604));
    await page.locator('.mushaf-svg[data-page="604"]').waitFor();
    const badAsset=await page.evaluate(async()=>{const r=await fetch('data/not-a-real-file.json');return {status:r.status,text:await r.text()};});
    assert.equal(badAsset.status,504);
    assert.ok(!badAsset.text.includes('<html'),'A missing JSON asset must not return the app HTML');
    assert.deepEqual(errors,[]);
    console.log('✓ Offline relaunch, page 604 rendering, and safe missing-asset handling');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
