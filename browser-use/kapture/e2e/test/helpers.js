import { expect } from 'chai';

// Helper to validate common response properties
export function expectValidTabInfo(data) {
  expect(data).to.have.property('url').that.is.a('string');
  expect(data).to.have.property('title').that.is.a('string');
  expect(data).to.have.property('domSize').that.is.a('number');
  expect(data).to.have.property('fullPageDimensions').that.is.an('object');
  expect(data.fullPageDimensions).to.have.property('width').that.is.a('number');
  expect(data.fullPageDimensions).to.have.property('height').that.is.a('number');
  expect(data).to.have.property('viewportDimensions').that.is.an('object');
  expect(data.viewportDimensions).to.have.property('width').that.is.a('number');
  expect(data.viewportDimensions).to.have.property('height').that.is.a('number');
  expect(data).to.have.property('scrollPosition').that.is.an('object');
  expect(data.scrollPosition).to.have.property('x').that.is.a('number');
  expect(data.scrollPosition).to.have.property('y').that.is.a('number');
  expect(data).to.have.property('pageVisibility').that.is.an('object');
  expect(data.pageVisibility).to.have.property('visible').that.is.a('boolean');
  expect(data.pageVisibility).to.have.property('visibilityState').that.is.a('string');
}
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
