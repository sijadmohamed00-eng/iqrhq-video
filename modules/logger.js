var LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
var currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'];

function log(level, args) {
  if (LEVELS[level] < currentLevel) return;
  var ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  var prefix = { debug: 'DEBUG', info: 'INFO ', warn: 'WARN ', error: 'ERROR' }[level];
  var msg = ['[' + ts + '] ' + prefix].concat(args);
  if (level === 'error') {
    console.error.apply(console, msg);
  } else {
    console.log.apply(console, msg);
  }
}

export var logger = {
  debug: function() { log('debug', Array.from(arguments)); },
  info:  function() { log('info',  Array.from(arguments)); },
  warn:  function() { log('warn',  Array.from(arguments)); },
  error: function() { log('error', Array.from(arguments)); },
};
