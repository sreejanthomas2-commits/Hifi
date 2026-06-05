var fso = new ActiveXObject("Scripting.FileSystemObject");
var f = fso.OpenTextFile("app.js", 1);
var code = f.ReadAll();
f.Close();

try {
  eval(code);
  WScript.Echo("Syntax OK");
} catch(e) {
  WScript.Echo("Syntax Error: " + e.message + " at line " + e.line);
}
