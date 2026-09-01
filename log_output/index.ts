const randomString = crypto.randomUUID();

function outputLog() {
  console.log(`${new Date().toISOString()}: ${randomString}`);
}

outputLog();
setInterval(outputLog, 5000);
