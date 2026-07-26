const blocked = [
  'rm -rf /',
  'format c:',
  'diskpart',
  'powershell -enc AAA',
  'del /s C:\\',
];
const deny = /[;&|><`]|\b(rm\s+-rf|format|diskpart|del\s+\/s|rmdir\s+\/s|shutdown|reboot|reg\s+(add|delete)|powershell\s+-enc|mkfs|dd\s+if=)\b/i;
if (blocked.every((item) => deny.test(item))) console.log('Security smoke lulus.');
else process.exit(1);
