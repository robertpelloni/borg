import { expect } from 'chai';
import { framework } from '../test-framework.js';
import { expectValidTabInfo } from './helpers.js';

describe('Kapture E2E Tests', function() {

  describe('Basic Functionality', function() {
    it('should list available resources', async function() {
      const resources = await framework.listResources();

      expect(resources).to.be.an('array');
      expect(resources.length).to.be.greaterThan(0);

      // Should have tabs resource
      const tabsResource = resources.find(r => r.uri === 'kapture://tabs');
      expect(tabsResource).to.exist;
      expect(tabsResource.name).to.equal('Connected Browser Tabs');
    });

    it('should list available tools', async function() {
      const tools = await framework.listTools();

      expect(tools).to.be.an('array');
      expect(tools.length).to.be.greaterThan(0);

      // Check for essential tools
      const toolNames = tools.map(t => t.name);
      expect(toolNames).to.include('navigate');
      expect(toolNames).to.include('click');
      expect(toolNames).to.include('fill');
      expect(toolNames).to.include('screenshot');
    });

    it('should query tabs and find test page', async function() {
      const testTab = await framework.openTestPage();

      expect(testTab).to.have.property('tabId');
      expect(testTab).to.have.property('url');
      expect(testTab.url).to.include('test.html');
    });
  });

  describe('Tab Operations', function() {
    let testTab;

    beforeEach(async function() {
      testTab = await framework.openTestPage();

      // Refresh the page to reset state by navigating to itself
      await framework.callTool('navigate', {
        tabId: testTab.tabId,
        url: "http://localhost:61822/test.html"
      });
    });

    it('should navigate to a URL', async function() {
      const result = await framework.callTool('navigate', {
        tabId: testTab.tabId,
        url: 'http://localhost:61822/test.html?navigated=true'
      });

      // Check that we got a response with all common properties
      const resultData = JSON.parse(result.content[0].text);
      expectValidTabInfo(resultData);
      expect(resultData.url).to.equal('http://localhost:61822/test.html?navigated=true');

      // Verify navigation happened by checking current tab state
      const tabInfo = await framework.readResource(`kapture://tab/${testTab.tabId}`);
      const tab = JSON.parse(tabInfo.contents[0].text);
      expect(tab.url).to.equal('http://localhost:61822/test.html?navigated=true');
    });

    it('should take a screenshot', async function() {
      const result = await framework.callTool('screenshot', {
        tabId: testTab.tabId
      });

      expect(result.content).to.have.lengthOf(2);
      expect(result.content[0].type).to.equal('text');

      // Validate common properties in the text response
      const resultData = JSON.parse(result.content[0].text);
      expectValidTabInfo(resultData);

      expect(result.content[1].type).to.equal('image');
      expect(result.content[1].mimeType).to.match(/^image\//);
      expect(result.content[1].data).to.be.a('string');
    });

    it.skip('should navigate back in history', async function() {
      // First navigate to a new page to have history
      await framework.callTool('navigate', {
        tabId: testTab.tabId,
        url: 'http://localhost:61822/test.html'
      });

      await framework.callTool('navigate', {
        tabId: testTab.tabId,
        url: 'http://lvh.me:61822/test.html'
      });

      // Now go back
      const result = await framework.callTool('back', {
        tabId: testTab.tabId
      });

      const resultData = JSON.parse(result.content[0].text);
      expectValidTabInfo(resultData);

      // Verify we're back at localhost
      const tabInfo = await framework.readResource(`kapture://tab/${testTab.tabId}`);
      const tab = JSON.parse(tabInfo.contents[0].text);
      expect(tab.url).to.include('localhost:61822');
    });

    it.skip('should navigate forward in history', async function() {
      // First set up history
      await framework.callTool('navigate', {
        tabId: testTab.tabId,
        url: 'http://lvh.me:61822/test.html?page=1'
      });

      await framework.callTool('navigate', {
        tabId: testTab.tabId,
        url: 'http://lvh.me:61822/test.html?page=2'
      });

      // Go back to page=1
      await framework.callTool('back', {
        tabId: testTab.tabId
      });

      // Now go forward
      const result = await framework.callTool('forward', {
        tabId: testTab.tabId
      });

      const resultData = JSON.parse(result.content[0].text);
      expectValidTabInfo(resultData);

      // Verify we're back at page=2
      const tabInfo = await framework.readResource(`kapture://tab/${testTab.tabId}`);
      const tab = JSON.parse(tabInfo.contents[0].text);
      expect(tab.url).to.include('page=2');
    });

    it('should block navigation to non-http(s) URLs', async function() {
      const result = await framework.callTool('navigate', {
        tabId: testTab.tabId,
        url: 'file:///etc/passwd'
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).to.have.property('error');
      expect(resultData.error.code).to.equal('NAVIGATION_BLOCKED');
    });

    it('should handle back with no history', async function() {
      // First navigate to reset history
      await framework.callTool('navigate', {
        tabId: testTab.tabId,
        url: 'http://lvh.me:61822/test.html'
      });

      // Try to go back when there's no history
      const result = await framework.callTool('back', {
        tabId: testTab.tabId
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).to.have.property('error');
      expect(resultData.error.code).to.equal('NAVIGATION_FAILED');
    });
  });
});
