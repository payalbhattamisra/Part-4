const mongoose = require('mongoose')
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
//const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
//Render and vercel
const bcrypt = require('bcryptjs');
const xml2js = require('xml2js');

const jwt = require('jsonwebtoken');
const userModel = require('./models/userD');
const ProductModel = require('./models/productDetails')
const gen = require("@codedipper/random-code");
var nodemailer = require('nodemailer');
const app = express();
const QRCode = require('qrcode'); 
const Consumer=require('./models/consumer')
const Complain = require('./models/complain'); 
const PORT = process.env.PORT || 3000; 
const axios = require('axios');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
// Middleware to parse JSON requests
app.use(bodyParser.json());


app.get("/login", (req, res) => {
    res.render('login');
});
app.get("/", (req, res) => {
    res.render('landingPage');
});

app.get("/register", (req, res) => {
    res.render('register');
});
app.get("/consumer",(req,res) => {
    res.render("consumer");
});
app.get("/rolePage", (req, res) => {
    res.render('rolePage');
});

app.get("/loginPage", (req, res) => {
    res.render('login');
});
app.get("/loginconsumer", (req, res) => {
    res.render('loginconsumer');
});
app.get("/Recommendations", isLoggedIn, async (req, res) => {
    try {
        const user = await Consumer.findById(req.user.userID);

        if (!user || !user.hospital_name) {
            return res.status(404).send("Hospital name not found.");
        }

        res.redirect(`http://127.0.0.1:8050/${user.hospital_name}`);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send("Internal server error.");
    }
});
app.post("/createmanufacture", async (req, res) => {
    const { userID, email, password, gst, pincode, name, address, contact_number } = req.body;

    try {
        // Check if the email or userID is already registered
        let userCheck = await userModel.findOne({ email });
        let IdCheck = await userModel.findOne({ userID });

        if (userCheck) {
            return res.send("Email already registered");
        }

        if (IdCheck) {
            return res.send("User ID already used");
        }

        
        if (String(pincode).length !== 6) {
            return res.send("Pincode must be exactly 6 digits");
        }

        
        if (String(contact_number).length !== 10) {
            return res.send("Contact number must be exactly 10 digits");
        }

        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        
        let createdUser = await userModel.create({
            userID,
            name,
            address,
            pincode,
            contact_number,
            email,
            password: hash,
            GST: gst,
        });

        
        res.redirect("/success");
    } catch (error) {
        res.status(500).send("An error occurred during registration");
    }
});



app.post("/login", async (req, res) => {
    const {userID, email, password } = req.body;

    try {
        let userCheck = await userModel.findOne({ email });
        let userIDCheck = await userModel.findOne({ userID });


        if (!userCheck) {
            return res.send("Invalid Credentials");
        }

        if (!userIDCheck) {
            return res.send("Invalid Credentials");
        }

        const result = await bcrypt.compare(password, userCheck.password);
        if (result) {
            let token = jwt.sign({ email , userID}, "shsh");
            res.cookie("token", token);
            res.redirect("/profile");
        } else {
            res.send("Invalid Credentials");
        }
    } catch (error) {
        res.status(500).send("An error occurred during login process");
    }
});



app.get("/success", (req, res) => {
    res.render('success');
});

app.get("/success_consumer", (req, res) => {
    res.render('success_consumer');
});


function isLoggedIn(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect("/loginPage");
    }

    try {
        const data = jwt.verify(token, "shsh");
        req.user = data; 
        next(); 
    } catch (err) {
        return res.redirect("/loginPage"); 
    }
}




app.get('/profile', isLoggedIn, async (req, res) => {
    console.log(req.user); 
    try {
        const products = await ProductModel.find({ manufactureId: req.user.userID });

        const filteredProducts = products.map(product => ({
            manufactureId: product.manufactureId,
            manufactureName :  product.manufactureName,
            consumerId: product.consumerId,
            consumerName: product.consumerName,
            productName: product.productName,
            quantity:product.quantity,
            price:product.price,
            orderDate: product.orderDate,
            _id: product._id 
        }));

        const wholeData = {

            local: req.user,
            products: filteredProducts 
        }

        res.render('profile', { data: wholeData });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server Error');
    }
});



app.get('/registerProductDetails', isLoggedIn, async(req, res) => {
    if (!req.user) {
        return res.redirect('/login'); // Ensure the user is logged in
    }
   console.log("User Data:", req.user);
    const userData = {
        local: {
            userID: req.user.userID,
            email: req.user.email
        }
    };

    try {
        // Fetch manufacture name from the userModel using userID
        const user = await userModel.findOne({ userID: req.user.userID });  

        if (user) {
            userData.local.manufactureName = user.name; 
        } else {
            userData.local.manufactureName = "Unknown Manufacturer";  
        }

        res.render('productDetailsRegister', { data: userData });
    } catch (err) {
        console.error("Error fetching user details:", err.message);
        res.status(500).send('An error occurred while fetching user details.');
    }
});

app.post('/registerProductDetails', async (req, res) => {
    const token = req.cookies.token;

    // JWT Verification with error handling
    let data;
    try {
        data = jwt.verify(token, "shsh");
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return res.status(401).send('Unauthorized');
    }
    req.user = data; 

    // Generate a single Security Code
    const SecurityCode = String(gen(4));
    const { manufactureId, manufactureName, consumerId, consumerName, productName, quantity, price, pincode } = req.body;

    try {
        // Validate required fields
        if (!productName || productName.length === 0 || !manufactureId || !consumerId || !quantity || !price) {
            console.log("Missing required fields");
            return res.status(400).send("Missing required fields");
        }

        // Build the products array
        const products = productName.map((name, index) => ({
            name,
            quantity: Number(quantity[index]),
            price: Number(price[index]),
        }));

        console.log("Products Array:", products);
        
        // Calculate total order value
        const orderTotal = products.reduce((acc, product) => acc + (product.price * product.quantity), 0);
        console.log("Calculated Order Total:", orderTotal);
        
        // Create a new product entry
        const newProductDetails = await ProductModel.create({
            manufactureId,
            manufactureName,
            consumerId: consumerId[0], // Assuming a single consumer
            consumerName: consumerName[0], // Assuming a single consumer
            productName: products, // Now an array of product objects
            pincode: pincode[0], // Use first pincode
            SecurityCode, // Use generated security code
            orderTotal // Use calculated total
        });

        console.log('New Product Details:', newProductDetails);

        if (!newProductDetails._id) {
            throw new Error("Product ID is not defined after creation");
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const productUrl = `${baseUrl}/productVerify/${newProductDetails._id}`;

        //const productUrl = `https://sih-8aav.onrender.com/productVerify/${newProductDetails._id}`;
        console.log(`Product URL: ${productUrl}`);

        // Generate QR Code
        const qrCodeUrl = await QRCode.toDataURL(productUrl);

        // Configure email transporter using environment variables
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            auth: {
                user: 'lorybhattamisra@gmail.com',
                pass: 'vaasjkqjakfimenh'
            }
        });

        // Mail options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: req.user.email,
            subject: 'Security Code and QR Code for your order',
            text: `Your Security Code: ${SecurityCode}`,
            html: `<p>Your Security Code: ${SecurityCode}</p><p>Scan this QR Code to view your order details:</p><img src="${qrCodeUrl}" alt="QR Code" />`
        };

        // Send the email
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');

        console.log(`Redirecting with Product ID: ${newProductDetails._id}`); 
        res.redirect(`/showQRCode?qrCodeUrl=${encodeURIComponent(qrCodeUrl)}&productId=${newProductDetails._id}`);
        
    } catch (err) {
        console.error('Error registering product details:', err.message);
        res.status(500).send('An error occurred while registering the product details.');
    }
});

app.get('/showQRCode', (req, res) => {
    const qrCodeUrl = req.query.qrCodeUrl;
    const productId = req.query.productId;

    console.log(`Your product ID is ${productId}`);
    
    // Create the dynamic product link
    const productLink = `${req.protocol}://${req.get('host')}/productVerify/${productId}`;
    
    res.render('displayQRCode', { qrCodeUrl, productId, productLink }); // Pass the product link to EJS template
});

 

function isHaveToken(req, res, next) {
    const token = req.cookies.token;
    
    if (!token) {
        return res.send("You Don't have a Proper Token Or Not using the Authorized Scanner");
    }

    try {
        const data = jwt.verify(token, "shsh");
        req.user = data; 
        next(); 
    } catch (err) {
        return res.redirect("/profilelogin"); 
    }
}

app.get('/productVerify/:id', isHaveToken ,async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found');
        }
        
        // If user is authenticated, render the product details page
        res.render('AuthCode', { product });
        
    } catch (err) {
        console.error('Error fetching product details:', err.message);
        res.status(500).send('An error occurred while retrieving product details.');
    }
});




app.get('/logout', (req, res) => {

    res.cookie("token" , "")
    res.redirect("/loginPage")
    
});


app.get('/fullorderdetails/:id', async (req, res) => {
    try {
        const product = await ProductModel.findOne({ _id: req.params.id });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.render('productDetails',{product})
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post("/submitAuthCode", async (req, res) => {
    const securityCode = req.body.UsersecurityCode;
    const productId = req.body.productId;
    
    try {
        
        const product = await ProductModel.findById(productId);

        if (!product) {
            return res.status(404).send("Product not found.");
        }
        
    
        if (product.SecurityCode === securityCode) {

            res.render("verifyProductByQr" , {product})
            
        } else {
            res.send("Invalid security code. Please try again.");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while processing your request.");
    }
});

app.get("/receive-order/:id", async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await ProductModel.findOne({ _id: productId });

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Fetch the manufactureId and consumerId for the product
        const complainData = {
            manufactureId: product.manufactureId,  // Assuming the product has a 'manufactureId' field
            consumerId: product.consumerId,  // Assuming the product has a 'consumerId' field
            order_id: product._id,
            product_complain: []
        };

        res.render('receiveOrder', { product, complainData });
    } catch (error) {
        console.error("Error:", error);
        if (error.name === 'MongoTimeoutError') {
            return res.status(503).json({ message: "Database query timeout, please try again later" });
        }
        res.status(500).json({ message: "Server error", error: error.message });
    }
});
app.post('/receive-order/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await ProductModel.findById(productId);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        const complainData = {
            manufactureId: product.manufactureId,
            consumerId: product.consumerId,
            order_id: product._id,
            product_complain: product.productName.map(item => ({
                productName: item.name,
                send_quantity: item.quantity,
                receive_quantity: req.body[`receivedQuantity_${item.name}`] || item.quantity,
                complain_category: req.body[`complainCategory_${item.name}`] || "Damaged Goods"
            })),
            complain_status: "Pending",
            complain_date: new Date()
        };

        const newComplain = new Complain(complainData);
        await newComplain.save();

        // Render the complaint details page with the saved complaint data
        res.render('complaintDetails', { complain: newComplain });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Server error");
    }
});
app.get("/complaints", isLoggedIn, async (req, res) => {
    try {
        const manufactureId = req.user.userID; // Assuming the userID is stored in the token
        console.log("Manufacture ID:", manufactureId);

        const complain = await Complain.find({ manufactureId });
        if (!complain) {
            return res.status(404).render('errorPage', { message: "No complaint found" });
        }

        console.log(complain)

        // const complainData = {
        //     manufactureId: complain.manufactureId,
        //     _id: complain._id,
        //     consumerId: complain.consumerId,
        //     order_id: complain.order_id,
        //     complain_status: complain.complain_status,
        // };
      
        const wholeData = {
           local: req.user,
        }
 
        // Pass complainData to the EJS template
        res.render('complaints', { manufactureId , complain, wholeData });
        
    } catch (error) {
        console.error("Error:", error);
        res.status(500).render('errorPage', { message: "Server error", error: error.message });
    }
});


app.post('/createconsumer', async (req, res) => {
    try {
        // Destructure data from the form submission
        const { hospital_name, consumer_email, consumer_password, location, pincode, hospital_license_no } = req.body;
        const hashedPassword = await bcrypt.hash(consumer_password, 10);
        const newConsumer = new Consumer({
            hospital_name,
            consumer_email,
            consumer_password:hashedPassword,
            location,
            pincode,
            hospital_license_no
        });
 
        await newConsumer.save();
  
        res.redirect("/success_consumer");
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).send("Email is already registered.");
        } else {
            res.status(500).send("Error registering consumer: " + error.message);
        }
    }
});


//     const { consumer_email , consumer_password } = req.body;

//     try {
//         let  emailCheck = await  Consumer.findOne({ consumer_email });
         
//         if (!emailCheck) {
//             return res.send("Invalid  email");
//         }
//         const passwordMatch = await bcrypt.compare(consumer_password, emailCheck.consumer_password);
//         if (!passwordMatch) {
//             return res.status(400).send("Invalid password");
//         }

//         // Generate JWT token if credentials are valid
//         let token = jwt.sign(
//             { userID: emailCheck._id, hospital_name: emailCheck.hospital_name },
//             "shsh", 
//             { expiresIn: "1h" }
//         );

//         res.cookie("token", token, { httpOnly: true, secure: true });
//         // res.send("Login successful");
//         res.redirect("/profilelogin")
//     } catch (error) {
//         res.status(500).send("An error occurred during login process");
//     }
// });

app.post("/loginconsumer", async (req, res) => {
    const { consumer_email, consumer_password } = req.body;

    try {
        let consumer = await Consumer.findOne({ consumer_email });
        if (!consumer || !await bcrypt.compare(consumer_password, consumer.consumer_password)) {
            return res.send("Invalid Credentials");
        }

        const token = jwt.sign({ userID: consumer._id, hospital_name: consumer.hospital_name }, "shsh", { expiresIn: "1h" });
        res.cookie("token", token, { httpOnly: true, secure: false, sameSite: 'lax' });
        res.redirect("/profilelogin");
    } catch (error) {
        res.status(500).send("An error occurred during login process");
    }
});

app.get('/profilelogin', isLoggedInconsumer, async (req, res) => {
    try {
        // Find products linked to this userID and hospital name
        const products = await ProductModel.find({
            consumerName: req.user.hospital_name
        });

        const filteredProducts = products.map(product => ({
            _id: product._id,
            manufactureId: product.manufactureId,
            manufactureName: product.manufactureName,
            consumerId: product.consumerId,
            consumerName: product.consumerName,
            productName: product.productName,
            orderTotal: product.orderTotal,
            orderDate: product.orderDate,
            order_status: product.order_status,
        }));

        const wholeData = {
            local: {
                userID: req.user.userID,
                name: req.user.hospital_name
            },
            products: filteredProducts
        };

        res.render('profilelogin', { data: wholeData });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server Error');
    }
});


function isLoggedInconsumer(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send('Unauthorized: No token provided');
    }

    try {
        const decoded = jwt.verify(token, "shsh");
        req.user = decoded; // { userID, hospital_name }
        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(403).send('Forbidden: Invalid token');
    }
}



// app.post("/AuthPage", async(req, res) => {

//     const securityCode = req.body.securityCode;

//     try{

//         const temp = ProductModel.find({name:})


//     }catch{


//     }
    
    
//     if (securityCode === 'expectedCode') {

//         res.send("Security code verified successfully.");

//     } else {

//         res.send("Invalid security code. Please try again.");

//     }

// });

app.get('/favicon.ico', (req, res) => res.status(204).end());
//  app.get('/fetchDataLDC', async (req, res) => {
//     const fetchDataUrl = 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/LDB/01';
  
//     const headers = {
//       'Content-Type': 'application/json',
//       'Accept': 'application/json',
//     };
  
//     const token = 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJnZWV0c2FodV91c3IiLCJpYXQiOjE3MzMzMTU0MDgsImFwcHMiOiJkYXRhcHVzaCJ9.IExaWHV0otlwf6eTL-NPPz-MhpUC6eOKv3qQiET-W-FtIxav1fJrpyuR6mvNZtA_l7us4AWg1kWYikQk5JdkCA';
//     const requestBody = {
//       containerNumber: 'NSST1234570',
//     };
  
//     const fetchDataHeaders = {
//       ...headers,
//       Authorization: `Bearer ${token}`,
//     };
  
//     try {
//       // Fetch data from the external API
//       const dataResponse = await axios.post(fetchDataUrl, requestBody, { headers: fetchDataHeaders });
  
//       // Check if the response contains the required data
//       if (
//         dataResponse.data &&
//         dataResponse.data.response &&
//         dataResponse.data.response[0] &&
//         dataResponse.data.response[0].response
//       ) {
//         const eximContainerTrail = dataResponse.data.response[0].response.eximContainerTrail;
//       console.log(eximContainerTrail);
//         // Render the EJS template with the API response data
//         res.render('dashboard', { eximContainerTrail });
//       } else {
//         res.status(404).send('No data found in the API response.');
//       }
//     } catch (error) {
//       console.error('Error occurred:', error.response?.data || error.message);
//       res.status(500).send('An error occurred while fetching data.');
//     }
//   });
app.get('/ULIP', async (req, res) => {
  
      const url = 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/user/login';
  
      const data = {
          username: 'geetsahu_usr',
          password: 'geetsahu@25112024',
      };
  
      const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
      };
  
      try {
          const response = await axios.post(url, data, { headers });
          console.log('Response data:', response.data);
      } catch (error) {
          console.error('Error occurred:', error.response?.data || error.message);
      }
  }); 



app.get('/ulip-data', async (req, res) => {
    try {
        // Hardcoded container number
        const containerNumber = 'NSST1234570';

        const ulipResponse = await axios.post(
            'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/LDB/01',
            { containerNumber },
            {
                headers: {
                    Authorization: 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJnZWV0c2FodV91c3IiLCJpYXQiOjE3MzMyMzQwOTAsImFwcHMiOiJkYXRhcHVzaCJ9.AoIOZcJfoh5PmhDKw7nz8bIDBTxamXHhvPrdhUzl4B6iPAGPKz1H6BaWt-S2W_CgbSQtj_AcdWm55WHjkeV7Rg',
                    Accept: 'application/json',
                },
            }
        );

        // Send back the response from ULIP API
        res.status(200).json(ulipResponse.data);
    } catch (error) {
        console.error('Error while calling ULIP API:', error.message);
        res.status(500).json({ error: 'Failed to fetch data from ULIP API', details: error.message });
    }
});

let cachedToken = null;
let tokenExpiry = null;

// Function to fetch token and manage caching
const getToken = async () => {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken; // Return cached token if valid
    }

    const url = 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/user/login';
    const data = {
        username: 'geetsahu_usr',
        password: 'geetsahu@25112024',
    };
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };

    try {
        const response = await axios.post(url, data, { headers });
        cachedToken = response.data?.token; // Extract token from response
        tokenExpiry = Date.now() + 3600 * 1000; // Assuming token expires in 1 hour
        return cachedToken;
    } catch (error) {
        console.error('Error fetching token:', error.response?.data || error.message);
        throw new Error('Failed to fetch token');
    }
};

// Endpoint to fetch LDC data
app.get('/fetchDataLDC', async (req, res) => {
    const fetchDataUrl = 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/LDB/01';
    const requestBody = {
        containerNumber: 'NSST1234570', // Use container number from the example
    };

    try {
        const token = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJnZWV0c2FodV91c3IiLCJpYXQiOjE3MzM0MDQ2MDgsImFwcHMiOiJkYXRhcHVzaCJ9.WE0QAhmqjkY2En6cJno1woPlQGJI5WfzEzqlX8Z6SS4lK3igA1hjttAeCBPbGNDzRuFaUja-ELD__cg3xbyXZg";
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
        };

        const response = await axios.post(fetchDataUrl, requestBody, { headers });

        const eximContainerTrail = response.data?.response?.[0]?.response?.eximContainerTrail;

        if (eximContainerTrail) {
            res.status(200).json({ eximContainerTrail });
        } else {
            res.status(404).send('No data found in the API response.');
        }
    } catch (error) {
        console.error('Error occurred:', error.response?.data || error.message);
        res.status(500).send('An error occurred while fetching LDC data.');
    }
});

// app.get('/fetchDataVAHAN', async (req, res) => {
//     const fetchDataUrl = 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/VAHAN/01';
//     const requestBody = {
//         vehiclenumber: 'UP91L0001',
//     };

//     try {
//         const token = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJnZWV0c2FodV91c3IiLCJpYXQiOjE3MzMzMTU0MDgsImFwcHMiOiJkYXRhcHVzaCJ9.IExaWHV0otlwf6eTL-NPPz-MhpUC6eOKv3qQiET-W-FtIxav1fJrpyuR6mvNZtA_l7us4AWg1kWYikQk5JdkCA"
//         const headers = {
//             'Content-Type': 'application/json',
//             Accept: 'application/json',
//             Authorization: `Bearer ${token}`,
//         };

//         const response = await axios.post(fetchDataUrl, requestBody, { headers });
//         const vahanData = response.data;

//         if (vahanData) {
//             res.status(200).json(vahanData);
//         } else {
//             res.status(404).send('No data found in the API response.');
//         }
//     } catch (error) {
//         console.error('Error occurred:', error.response?.data || error.message);
//         res.status(500).send('An error occurred while fetching VAHAN data.');
//     }
// });

app.get('/fetchDataVAHAN', async (req, res) => {
    const fetchDataUrl = 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/VAHAN/01';
    const requestBody = {
        vehiclenumber: 'UP91L0001',
    };

    try {
        const token = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJnZWV0c2FodV91c3IiLCJpYXQiOjE3MzMzMTU0MDgsImFwcHMiOiJkYXRhcHVzaCJ9.IExaWHV0otlwf6eTL-NPPz-MhpUC6eOKv3qQiET-W-FtIxav1fJrpyuR6mvNZtA_l7us4AWg1kWYikQk5JdkCA";
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
        };

        const response = await axios.post(fetchDataUrl, requestBody, { headers });
        const vahanData = response.data;

        if (vahanData && vahanData.response && vahanData.response[0]) {
            const xmlData = vahanData.response[0].response;

            // Parse XML to JSON
            xml2js.parseString(xmlData, { explicitArray: false }, (err, jsonData) => {
                if (err) {
                    console.error('Error parsing XML:', err.message);
                    res.status(500).send('Failed to parse XML response.');
                } else {
                    res.status(200).json(jsonData);
                }
            });
        } else {
            res.status(404).send('No data found in the API response.');
        }
    } catch (error) {
        console.error('Error occurred:', error.response?.data || error.message);
        res.status(500).send('An error occurred while fetching VAHAN data.');
    }
});console.log("Server running on port", PORT);



// GET request handler
app.get('/fci', async (req, res) => {
    const fciUrl = 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/FCI/01';

    try {
        // Hardcoded Bearer token for staging
        const token = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJnZWV0c2FodV91c3IiLCJpYXQiOjE3MzM0MDQ2MDgsImFwcHMiOiJkYXRhcHVzaCJ9.WE0QAhmqjkY2En6cJno1woPlQGJI5WfzEzqlX8Z6SS4lK3igA1hjttAeCBPbGNDzRuFaUja-ELD__cg3xbyXZg";

        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
        };

        // Send GET request to the external API (staging)
        const response = await axios.get(
            fciUrl,
            {
                headers: headers,
                params: req.query, // Forward query parameters from the incoming GET request
            }
        );

        // Send back the API response
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error occurred:', error.response?.data || error.message);
        res.status(500).send('An error occurred while fetching FCI data.');
    }
});

app.post('/fci', async (req, res) => {
    const fciUrl = 'https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0/FCI/01';

    try {
        // Hardcoded Bearer token for staging
        const token = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJnZWV0c2FodV91c3IiLCJpYXQiOjE3MzM0MDQ2MDgsImFwcHMiOiJkYXRhcHVzaCJ9.WE0QAhmqjkY2En6cJno1woPlQGJI5WfzEzqlX8Z6SS4lK3igA1hjttAeCBPbGNDzRuFaUja-ELD__cg3xbyXZg";

        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
        };

        // Send POST request to the external API (staging)
        const response = await axios.post(
            fciUrl,
            {},  // Empty body as per the curl request '--data-raw "{}"'
            {
                headers: headers,
            }
        );

        // Send back the API response
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error occurred:', error.response?.data || error.message);
        res.status(500).send('An error occurred while fetching FCI data.');
    }
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});