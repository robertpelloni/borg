import { GroupedEventLog } from './src/output.js';

const log = new GroupedEventLog({ maxEventsPerGroup: 3 });

// Add 5 events to same source
for (let i = 1; i <= 5; i++) {
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
console.log('Contains ses_2:', output.includes('ses_2'));
console.log('Contains ses_3:', output.includes('ses_3'));
console.log('Contains ses_4:', output.includes('ses_4'));
console.log('Contains ses_5:', output.includes('ses_5'));
