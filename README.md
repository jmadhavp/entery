# Daily Inventory - Small Business Management

A hybrid inventory and sales management application built for small businesses.

## Architecture
- **Frontend**: GitHub Pages (HTML/CSS/JavaScript)
- **Database**: Firebase Firestore
- **Backup & Reports**: Google Sheets

## Features
- Dashboard with key metrics
- Sales and purchases management
- Inventory tracking with low-stock alerts
- Customers and suppliers management
- Expense tracking
- Profit reports
- Search functionality
- Undo delete
- CSV export
- QR invoices
- Dark mode
- Offline support with sync later

---

## 🚀 Step-by-Step Firebase Setup Guide

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Enter a project name (e.g., "Daily Inventory")
4. (Optional) Enable Google Analytics
5. Click **Create project** and wait for it to finish

### Step 2: Enable Firestore Database
1. In your Firebase project, go to **Firestore Database** (under Build)
2. Click **Create Database**
3. Select **Start in test mode** (for development/testing)
4. Click **Next**
5. Choose a location (select the one closest to you)
6. Click **Enable**

### Step 3: Enable Email/Password Authentication
1. Go to **Authentication** (under Build)
2. Click **Get started**
3. Select **Email/Password**
4. Toggle the **Enable** switch to ON
5. Click **Save**

### Step 4: Add a Web App to Get Firebase Credentials
1. On the Firebase Console home page, click the **Web** icon (</>) to add a web app
2. Enter an app nickname (e.g., "Daily Inventory Web App")
3. (Optional) Check "Also set up Firebase Hosting"
4. Click **Register app**
5. Copy the `firebaseConfig` object (it looks like this):
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
6. Click **Continue to console**

### Step 5: Configure Your App
1. Open `app.js` in your code editor
2. Find the `firebaseConfig` object at the top
3. Replace it with the one you copied from Firebase
4. Save the file

### Step 6: Create a User Account (For Login)
1. In Firebase Console, go to **Authentication** → **Users**
2. Click **Add user**
3. Enter an email and password
4. Click **Add user**

---

## 📊 Google Sheets Backup Setup (Optional)

### Step 1: Create a Google Sheet
1. Go to [Google Sheets](https://docs.google.com/spreadsheets/)
2. Create a new blank spreadsheet
3. Name it something like "Daily Inventory Backup"

### Step 2: Create a Google Apps Script
1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code in the editor
3. Paste this code:
   ```javascript
   function doPost(e) {
     try {
       const data = JSON.parse(e.postData.contents);
       const ss = SpreadsheetApp.getActiveSpreadsheet();
       
       // Create or get sheets
       const sheets = {
         sales: ss.getSheetByName('Sales') || ss.insertSheet('Sales'),
         purchases: ss.getSheetByName('Purchases') || ss.insertSheet('Purchases'),
         expenses: ss.getSheetByName('Expenses') || ss.insertSheet('Expenses'),
         inventory: ss.getSheetByName('Inventory') || ss.insertSheet('Inventory'),
         customers: ss.getSheetByName('Customers') || ss.insertSheet('Customers'),
         suppliers: ss.getSheetByName('Suppliers') || ss.insertSheet('Suppliers')
       };
       
       // Helper to write data
       function writeData(sheet, items) {
         if (!items.length) return;
         const headers = Object.keys(items[0]);
         sheet.clear();
         sheet.appendRow(headers);
         items.forEach(item => sheet.appendRow(headers.map(h => item[h])));
       }
       
       writeData(sheets.sales, data.sales);
       writeData(sheets.purchases, data.purchases);
       writeData(sheets.expenses, data.expenses);
       writeData(sheets.inventory, data.inventory);
       writeData(sheets.customers, data.customers);
       writeData(sheets.suppliers, data.suppliers);
       
       return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```
4. Click the **Save** button 💾 and name the project (e.g., "Daily Inventory Script")

### Step 3: Deploy the Script as a Web App
1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
3. Fill in:
   - **Description**: Daily Inventory Backup
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone, even anonymous
4. Click **Deploy**
5. Authorize access (you might need to click "Advanced" → "Go to [Project Name]")
6. Copy the **Web app URL**

### Step 4: Configure in the App
1. Open your inventory app (either locally or on GitHub Pages)
2. Go to the **Settings** page
3. Paste the Web app URL into the "Google Sheets Webhook URL" field
4. Click **Save**

---

## 🚀 GitHub Pages Deployment (Optional but Recommended)

### Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com/) and sign in
2. Click **New repository**
3. Name it (e.g., "daily-inventory")
4. Choose **Public** or **Private**
5. Click **Create repository**

### Step 2: Push Your Files
Follow the instructions on GitHub to push your files, or use these commands in your project folder:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Choose the **main** branch and **/ (root)** folder
5. Click **Save**
6. Wait a few minutes, then your site will be available at `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## 🎉 Usage

1. Open `index.html` in a browser (for local use) or visit your GitHub Pages URL
2. Click the **Login** button
3. Enter the email and password you created in Firebase
4. Start using the app!

---

## Need Help?
If you get stuck, check the Firebase documentation or reach out for support!
