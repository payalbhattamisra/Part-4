const mongoose = require('mongoose')
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('./models/userD');
const ProductModel = require('./models/productDetails')
const gen = require("@codedipper/random-code");
var nodemailer = require('nodemailer');
const app = express();
const QRCode = require('qrcode'); 
const Consumer=require('./models/consumer')
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

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
        res.send("You Don't have a Proper Token Or Not using the Authorized Scanner")
    }

    try {
        const data = jwt.verify(token, "shsh");
        req.user = data; 
        next(); 
    } catch (err) {
        return res.redirect("/profilelogin"); 
    }
}
app.get('/productVerify/:id', isHaveToken, async (req, res) => {
    if (!req.user) {
        return res.send("You don't have a proper token or are not using an authorized scanner");
    }

    const providedSecurityCode = req.query.SecurityCode;
    try {
        const product = await ProductModel.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        if (providedSecurityCode !== product.SecurityCode) {
            return res.status(403).send('Invalid security code. Verification failed.');
        }

        // Render the verification page with the product details if the code matches
        res.render('verifyProductByQr', { product });
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

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});