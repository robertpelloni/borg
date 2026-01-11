import { expect } from 'chai';
import { framework } from '../test-framework.js';
import { expectValidTabInfo } from './helpers.js';

describe('Reload Tool', function() {
  let testTab;

  beforeEach(async function() {
    testTab = await framework.openTestPage();

    // Navigate to test page with a timestamp to track reloads
    const timestamp = Date.now();
    await framework.callTool('navigate', {
      tabId: testTab.tabId,
      url: `http://localhost:61822/test.html?ts=${timestamp}`
    });
  });

  it('should reload the current page', async function() {
    // Get initial state
    const initialTabInfo = await framework.readResource(`kapture://tab/${testTab.tabId}`);
    const initialTab = JSON.parse(initialTabInfo.contents[0].text);
    const initialUrl = initialTab.url;

    // Create a unique marker by filling an input before reload
    await framework.callTool('fill', {
      tabId: testTab.tabId,
      selector: '#text-input',
      value: 'before-reload'
    });

    // Verify the input was filled
    const filledElement = await framework.callTool('elements', {
      tabId: testTab.tabId,
      selector: '#text-input'
    });
    const filledData = JSON.parse(filledElement.content[0].text);
    expect(filledData.elements[0].value).to.equal('before-reload');

    // Reload the page
    const result = await framework.callTool('reload', {
      tabId: testTab.tabId
    });

    // Check reload response
    const resultData = JSON.parse(result.content[0].text);
    expectValidTabInfo(resultData);
    expect(resultData.success).to.be.true;

    // The URL should remain the same after reload
    expect(resultData.url).to.equal(initialUrl);

    // Wait a bit for the page to fully reload
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the page was reloaded by checking that the input is now empty
    const reloadedElement = await framework.callTool('elements', {
      tabId: testTab.tabId,
      selector: '#text-input'
    });
    const reloadedData = JSON.parse(reloadedElement.content[0].text);
    expect(reloadedData.elements[0].value).to.be.undefined;
  });

  it('should maintain the same URL after reload', async function() {
    // Navigate to a specific URL with query parameters
    const testUrl = 'http://localhost:61822/test.html?test=reload&value=123';
    await framework.callTool('navigate', {
      tabId: testTab.tabId,
      url: testUrl
    });

    // Reload the page
    const result = await framework.callTool('reload', {
      tabId: testTab.tabId
    });

    const resultData = JSON.parse(result.content[0].text);
    expect(resultData.url).to.equal(testUrl);

    // Verify via tab info
    const tabInfo = await framework.readResource(`kapture://tab/${testTab.tabId}`);
    const tab = JSON.parse(tabInfo.contents[0].text);
    expect(tab.url).to.equal(testUrl);
  });

  it('should handle reload with anchors in URL', async function() {
    // Navigate to URL with anchor
    const anchorUrl = 'http://localhost:61822/test.html#anchor1';
    await framework.callTool('navigate', {
      tabId: testTab.tabId,
      url: anchorUrl
    });

    // Reload the page
    const result = await framework.callTool('reload', {
      tabId: testTab.tabId
    });

    const resultData = JSON.parse(result.content[0].text);
    expect(resultData.success).to.be.true;
    expect(resultData.url).to.equal(anchorUrl);
  });
});
