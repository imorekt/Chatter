const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('database.sqlite');

(async () => {
  try {
    db.run("DELETE FROM users WHERE email IN ('dhimzjtr1@gmail.com', 'pamzengaming@gmail.com', 'admin1', 'admin2')");
    
    // Also delete any existing moments/comments by them just in case? 
    // Not explicitly requested, I'll just delete the users.
    
    const salt1 = await bcrypt.genSalt(10);
    const hash1 = await bcrypt.hash('123', salt1);
    db.run("INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)", ['admin1', 'admin1', hash1, 'Admin 1']);

    const salt2 = await bcrypt.genSalt(10);
    const hash2 = await bcrypt.hash('123', salt2);
    db.run("INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)", ['admin2', 'admin2', hash2, 'Admin 2'], (err) => {
      if (err) console.error(err);
      else console.log("Done");
    });
  } catch (err) {
    console.error(err);
  }
})();
