const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const express = require('express');
const formidable = require('formidable');
const res = require('express/lib/response');
const { v4: uuidv4 } = require('uuid');
const braintree = require('braintree');
//const { UCS2_UNICODE_CI } = require('mysql/lib/protocol/constants/charsets')

// Create the connection to the MySQL database server
const conn = mysql.createConnection({
  connectionLimit: 10,
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'remote_pay',
})

// Connect to MySQL server
conn.connect((err) => {
  if (err) {
    console.log('Error connecting to mysql');
    console.log(err);
  }
  console.log('Connection successful');
})

// Generic call to MySQL db
const executeQuery = (sql, data) => {
  let promise = new Promise((resolve, reject) => {
    conn.query(sql, data, (err, results) => {
      /*console.log('\n\nRaw results');

      console.log(results);
      console.log(JSON.stringify(results));
      console.log(JSON.parse(JSON.stringify(results)));

      let response = JSON.parse(JSON.stringify(results));
      console.log(response[0].userId);*/

      if (err) {
        reject(err);
      } else {
        resolve(JSON.stringify(results));
      }
    });
  });

  promise
    .then((results) => {
      console.log('\n\nQuery result');
      console.log(results);
    })
    .catch((err) => {
      console.log('MySQL error');
      console.log(err);
    });

  return promise;
}

const executeQueryAsync = async (sql, data) => {
  let response = {success: false, result: '', error: ''};

  try {
    let resultString = await executeQuery(sql, data);
    
    response.success = (resultString.length) ? true : false;
    response.result = JSON.parse(resultString);

    console.log('\n\nAsync Result');
    console.log(response);

  } catch(err) {
    response.error = err;
  }

  return response;
}

// Check if the login credentials are correct
const checkLogin = async (username, password) => {
  return await executeQueryAsync("SELECT BIN_TO_UUID(userId) AS userId FROM Users WHERE username = ? AND password = ?", [username, password]);
}

// Register user
const register = async (firstname, lastname, email, username, password) => {
  return await executeQueryAsync("INSERT INTO Users (firstName, lastName, email, username, password) VALUES (?,?,?,?,?)", [firstname, lastname, email, username, password]);
}

// Get all transactions by a user
const getTransactions = async (userid) => {
  return await executeQueryAsync("SELECT BIN_TO_UUID(transactionId) AS transactionId, transactionTypeId, BIN_TO_UUID(userId) AS userId, description, amount, latitude, longitude, datetime FROM Transactions WHERE userId = UUID_TO_BIN(?) ORDER BY datetime DESC", [userid]);
}

// Get all transactions by a user
const scanPaymentRequest = async (userid, amount, description, filename) => {
  return await executeQueryAsync("INSERT INTO Transactions (transactionTypeId, userId, amount, description, filename) VALUES (1, UUID_TO_BIN(?),?,?,?)", [userid, parseFloat(amount), description, filename]);
}

// Top up credit for a single user
const topupCredit = async (userid, amount) => {
  let currentAmount = parseFloat(amount);

  let response = await executeQueryAsync("INSERT INTO TopUps (userId, amount) VALUES (UUID_TO_BIN(?),?)", [userid, currentAmount]);

  if (response.success && response.error == '') {
    await executeQueryAsync("UPDATE Users SET Credit = Credit + ? WHERE userId = UUID_TO_BIN(?)", [currentAmount, userid]);
  }

  return response;
}

// Get all top ups by a user
const getTopUps = async (userid) => {
  return await executeQueryAsync("SELECT BIN_TO_UUID(topUpId) AS topUpId, BIN_TO_UUID(userId) AS userId, amount, currency, exchangeRate, amountInRmb, datetime FROM TopUps WHERE userId = UUID_TO_BIN(?) ORDER BY datetime DESC", [userid]);
}


/******
 * 
 * API endpoints written in Express
 * 
 *******/

// Braintree
const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: 'qqs7pr8w92yy2vyg',
  publicKey: 'vtmrmdctjskh6ddv',
  privateKey: '6f4a7a24513d7728dfb364cd60980912'
});


// Express
const api = express()

api.use(express.json())
api.use(express.urlencoded({extended: true}))
api.use(express.static(__dirname + '/public'))

api.listen(3000, () => {
  console.log('API is up and running!');
})

/* api.get('/', (req, res) => {
  console.log(req);
  res.send('Hello, Fed!');
}) */

// Login
api.post('/login', async (req, res) => {
  console.log('\n\nPOST request received.');
  console.log(req.body);

  let response = await checkLogin(req.body.username, req.body.password);

  console.log('\n\nPOST response');
  console.log(response);

  res.send(response);
  //res.send({'userId': response.result[0].userId, 'success': response.success});
})

// Transactions
api.post('/transactions', async (req, res) => {
  console.log('get transaction received.');
  console.log(req.body);

  let response = await getTransactions(req.body.userid);

  console.log('\n\nPOST response');
  console.log(response);

  res.send(response);
  //res.send(response.result);
  //res.send({'success': response.success, 'result': response.result});
})

// Register
api.post('/register', async (req, res) => {
  console.log('\n\nPOST request received.');
  console.log(req.body);

  let response = await register(req.body.firstname, req.body.lastname, req.body.email, req.body.username, req.body.password);

  console.log('\n\nPOST response');
  console.log(response);

  res.send(response);

  //res.send({'success': response.success});
})

// Scan Payment Request
api.post('/scanPaymentRequest', async (req, res) => {
  console.log('\n\nPOST multipart request received.');
  console.log(req.body);

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    var success = true;
    var filename = uuidv4() + '.jpg';

    var filesJSON = JSON.parse(JSON.stringify(files));
    var oldPath = filesJSON['files']['filepath'];
    var newPath = path.join(__dirname, 'uploads') + '/' + filename;
		var rawData = fs.readFileSync(oldPath);

    fs.writeFile(newPath, rawData, (err) => {
      if (err) {
        console.log(err);
        success = false;
      }

      console.log(success);
      return success;
    });

    if (success)
      response = await scanPaymentRequest(fields['userid'], fields['amount'], fields['description'], filename);
  });

  res.send({'success': true});
})

// Topup
api.post('/topupCredit', async (req, res) => {
  console.log('\n\nPOST request received.');
  console.log(req.body);

  let response = await topupCredit(req.body.userid, req.body.amount);

  console.log('\n\nPOST response');
  console.log(response);

  res.send(response);
})

// Top Ups
api.post('/topups', async (req, res) => {
  console.log('get transaction received.');
  console.log(req.body);

  let response = await getTopUps(req.body.userid);

  console.log('\n\nPOST response');
  console.log(response);

  res.send(response);
})

// Payment
api.post('/payment', async (req, res) => {
  console.log('\n\nPOST payment request received.');
  console.log(req.body);

  // Use the payment method nonce here
  const nonceFromTheClient = req.body.paymentMethodNonce;

  // Create a new transaction for $10
  const newTransaction = gateway.transaction.sale({
    amount: parseFloat(req.body.amount),
    paymentMethodNonce: nonceFromTheClient,
    options: {
      // This option requests the funds from the transaction
      // once it has been authorized successfully
      submitForSettlement: true
    }
  }, async (error, result) => {
      if (result) {
        let response = await topupCredit(req.body.userid, req.body.amount);

        console.log('\n\nPOST payment response');
        console.log(req.body.userid);
        console.log(req.body.amount);
        console.log(response);

        res.send(result);
      } else {
        res.status(500).send(error);
      }
  });
})


/******
 * 
 * Test Harness
 * 
 *******/

const checkLoginTest = async () => {
  let response = await checkLogin('fed', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8');

  console.log('checkLogin result');

  if (response.success) {
    console.log('[' + response.result[0].userid + ']');
  } else {
    console.log('No user found');
  }
}

const registerTest = async () => {
  let response = await register('Peter', 'Kwok', 'peter.kwok@gmail.com', 'peter', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8');

  if (response.success) {
    console.log('Register Good');
  } else {
    console.log('Register Bad');
    console.log(response.error);
  }
}

const getTransactionsTest = async () => {
  let response = await getTransactions('asdf');

  if (response.success) {
    console.log('Transactions Good');
  } else {
    console.log('Transactions Bad');
    console.log(response.error);
  }
}

//getTransactionsTest();
//registerTest();
//checkLoginTest();