import { expect } from 'chai';
import { framework } from '../test-framework.js';
import { expectValidTabInfo } from './helpers.js';

describe('ElementsFromPoint Tool Tests', function() {
  beforeEach(async function() {
    // Navigate to test page to ensure clean state
    await framework.callTool('navigate', {
      url: "http://localhost:61822/test.html"
    });
  });

  it('should get elements at specific coordinates', async function() {
    // Get elements at coordinates (100, 100)
    const resultData = await framework.callToolAndParse('elementsFromPoint', {
      x: 100,
      y: 100
    });

    expectValidTabInfo(resultData);
    expect(resultData).to.have.property('x').that.equals(100);
    expect(resultData).to.have.property('y').that.equals(100);
    expect(resultData).to.have.property('elements').that.is.an('array');
    expect(resultData.elements.length).to.be.greaterThan(0);

    // Check first element properties
    const firstElement = resultData.elements[0];
    expect(firstElement).to.have.property('tagName').that.is.a('string');
    expect(firstElement).to.have.property('selector').that.is.a('string');
    expect(firstElement).to.have.property('bounds').that.is.an('object');
    expect(firstElement.bounds).to.have.all.keys('x', 'y', 'width', 'height');
    expect(firstElement).to.have.property('visible').that.is.a('boolean');
  });

  it('should return multiple elements in z-order', async function() {
    // First, get the h1 element bounds to ensure we hit it
    const h1Data = await framework.callToolAndParse('elements', {
      selector: 'h1'
    });

    const h1Bounds = h1Data.elements[0].bounds;

    // Use coordinates in the middle of the h1 element
    const x = h1Bounds.x + (h1Bounds.width / 2);
    const y = h1Bounds.y + (h1Bounds.height / 2);

    // Now get elements at those coordinates
    const resultData = await framework.callToolAndParse('elementsFromPoint', {
      x: x,
      y: y
    });

    expectValidTabInfo(resultData);
    expect(resultData.elements).to.be.an('array');
    expect(resultData.elements.length).to.be.greaterThan(1);

    // Should get h1, body, and html at minimum
    const tagNames = resultData.elements.map(el => el.tagName);
    expect(tagNames).to.include('h1');
    expect(tagNames).to.include('body');
    expect(tagNames).to.include('html');

    // Elements should be in z-order (topmost first)
    expect(tagNames[0]).to.equal('h1');
    expect(tagNames[tagNames.length - 1]).to.equal('html');
  });

  it('should return empty array for coordinates outside viewport', async function() {
    // Get elements at coordinates way outside viewport
    const resultData = await framework.callToolAndParse('elementsFromPoint', {
      x: -1000,
      y: -1000
    });

    expectValidTabInfo(resultData);
    expect(resultData).to.have.property('x').that.equals(-1000);
    expect(resultData).to.have.property('y').that.equals(-1000);
    expect(resultData).to.have.property('elements').that.is.an('array');
    expect(resultData.elements).to.have.lengthOf(0);
  });

  it('should handle missing coordinates', async function() {
    // Since x and y are required in the schema, the MCP server will reject these before reaching our code
    // We expect MCP validation errors, not our custom XY_REQUIRED errors

    try {
      await framework.callTool('elementsFromPoint', {
        y: 100
      });
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.include('Required');
    }

    try {
      await framework.callTool('elementsFromPoint', {
        x: 100
      });
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.include('Required');
    }

    try {
      await framework.callTool('elementsFromPoint', {
      });
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.include('Required');
    }
  });

  it('should handle decimal coordinates', async function() {
    // Get elements at decimal coordinates
    const resultData = await framework.callToolAndParse('elementsFromPoint', {
      x: 100.5,
      y: 150.75
    });

    expectValidTabInfo(resultData);
    expect(resultData).to.have.property('x').that.equals(100.5);
    expect(resultData).to.have.property('y').that.equals(150.75);
    expect(resultData).to.have.property('elements').that.is.an('array');
    expect(resultData.elements.length).to.be.greaterThan(0);
  });
});
