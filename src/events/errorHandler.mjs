const handleEvent = (type, fn) => process.on(type, fn);
handleEvent('unhandledRejection', console.log);
handleEvent('uncaughtException', console.log);
handleEvent('warning', console.log);
handleEvent('rejectionHandled', promise => console.log(`Rejection handled: ${promise}`));
handleEvent('beforeExit', code => console.log(`Before exit with code: ${code}`));
handleEvent('exit', code => console.log(`Exiting with code: ${code}`));
handleEvent('uncaughtExceptionMonitor', console.log);

console.log('error handler loaded');