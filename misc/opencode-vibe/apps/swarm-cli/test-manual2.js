import { GroupedEventLog } from './src/output.js';

const log = new GroupedEventLog(); // defaults to 10

// Add 15 events
for (let i = 1; i <= 15; i++) {
  log.addEvent({
    type: "session.status",
    properties: { sessionID: `ses_${i}` },
    source: "sse",
  });
}

const output = log.format();
console.log('Output:');
console.log(output);
console.log('\n---\n');
console.log('Contains ses_1:', output.includes('ses_1'));
console.log('Contains ses_5:', output.includes('ses_5'));
console.log('Contains ses_6:', output.includes('ses_6'));
console.log('Contains ses_15:', output.includes('ses_15'));
console.log('\n---\n');
console.log('Note: "ses_1" matches "ses_10", "ses_11", "ses_12", "ses_13", "ses_14", "ses_15"');
console.log('This is a substring matching issue in the test, not the implementation.');
