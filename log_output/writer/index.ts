const randomString = crypto.randomUUID();
const filePath = "/usr/src/app/files/log.txt";

function outputLog() {
  const log = `${new Date().toISOString()}: ${randomString}`;
  console.log(log);
  Bun.write(filePath, log);
  return log;
}

outputLog();
setInterval(outputLog, 5000);
