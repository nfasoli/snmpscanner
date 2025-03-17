const fs = require('fs');
const axios = require('axios');
const mysql = require('mysql2/promise');
const { Address4 } = require('ip-address');

// Connect to the MySQL database
async function getIPs() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'password',
        database: 'database'
    });

    const [rows] = await connection.execute("SELECT ip, mask FROM ip WHERE snmp = 'false'");
    await connection.end();
    return rows;
}

// Function to get subnet from IP address and mask
function getSubnet(ip, mask) {
    const address = new Address4(`${ip}/${mask}`);
    return address.startAddress().address.split('.').slice(0, 3).join('.');
}

// Function to make HTTP/HTTPS requests and save responses
async function fetchAndSave(ipAddress, mask) {
    let subnet = getSubnet(ipAddress, mask);
    let url = `http://${ipAddress}`;

    try {
        let response = await axios.get(url, {
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        saveResponse(subnet, ipAddress, response.data);
    } catch (error) {
        try {
            let response = await axios.get(`https://${ipAddress}`, {
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            });
            saveResponse(subnet, ipAddress, response.data);
        } catch (error) {
            console.log(`Failed to fetch ${ipAddress}: ${error.message}`);
        }
    }
}

// Function to save response to HTML file
function saveResponse(subnet, ipAddress, data) {
    if (!fs.existsSync(subnet)) {
        fs.mkdirSync(subnet);
    }
    fs.writeFileSync(`${subnet}/${ipAddress}.html`, data);
}

// Main function to execute the process
async function main() {
    let ips = await getIPs();
    for (let row of ips) {
        await fetchAndSave(row.ip, row.mask);
    }
}

main();