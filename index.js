const express = require("express");
const snmp = require("net-snmp");
const ip = require("ip");
const fs = require("fs");
const path = require("path");
const arp = require("@network-utils/arp-lookup");
const pingus = require("pingus");
const mysql = require("mysql2/promise");
const log = require("./utilities/logger.js");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const cors = require("cors");

app.use(cors());
const port = 5000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Gestisci le connessioni WebSocket
wss.on("connection", (ws) => {
  log.info("Client connected");

  ws.on("message", (message) => {
    log.info(`Received: ${message}`);
    const data = JSON.parse(message);
    if (data.action === "reload") {
      log.info("Reload action received");
      // Esegui l'operazione di ricarica e invia i nuovi dati al client
      const newData = { response: "token" };
      ws.send(JSON.stringify(newData));
    }

    // Invia una risposta al client
    // ws.send('Message received');
  });

  ws.on("close", () => {
    log.info("Client disconnected");
  });
});

const mac_prefix = "1.3.6.1.2.1.2.2.1.6";
const zebra_oids = {
  SerialNumber: "1.3.6.1.4.1.10642.1.4.0", // SN,
  Uptime: "1.3.6.1.2.1.1.3.0", // HostName
  Hostname: "1.3.6.1.2.1.1.5.0", // Uptime
  Syslocation: "1.3.6.1.2.1.1.6.0", // SysLocation
  //Inventory: "1.3.6.1.4.1.1129.1.2.1.1.1.4.1.0", // Inv
  Model: "1.3.6.1.2.1.25.3.2.1.3.1",
  FW: "1.3.6.1.4.1.10642.1.7.0",
  MAC: "1.3.6.1.2.1.2.2.1.6.2",
  MAC2: "1.3.6.1.2.1.2.2.1.6.3",
  sysDescr: "1.3.6.1.2.1.1.1.0",
};

const ricoh_oids = {
  SerialNumber: "1.3.6.1.4.1.367.3.2.1.2.1.4.0", // SN,
  Uptime: "1.3.6.1.2.1.1.3.0", // HostName
  Hostname: "1.3.6.1.2.1.1.5.0", // Uptime
  Syslocation: "1.3.6.1.2.1.1.6.0", // SysLocation
  //Inventory: "1.3.6.1.4.1.1129.1.2.1.1.1.4.1.0", // Inv
  Model: "1.3.6.1.2.1.25.3.2.1.3.1",
  FW: "1.3.6.1.4.1.367.3.2.1.1.1.2.0",
  MAC: "1.3.6.1.2.1.2.2.1.6.1",
  sysDescr: "1.3.6.1.2.1.1.1.0",
};

const toshiba_oids = {
  SerialNumber: "1.3.6.1.4.1.1129.1.2.1.1.1.1.1.0", // SN,
  Uptime: "1.3.6.1.2.1.1.3.0", // HostName
  Hostname: "1.3.6.1.2.1.1.5.0", // Uptime
  Syslocation: "1.3.6.1.2.1.1.6.0", // SysLocation
  Inventory: "1.3.6.1.4.1.1129.1.2.1.1.1.4.1.0", // Inv
  Model: "1.3.6.1.2.1.25.3.2.1.3.1",
  FW: "1.3.6.1.4.1.1129.1.2.1.1.1.1.2.0",
  MAC: "1.3.6.1.2.1.2.2.1.6.2",
  sysDescr: "1.3.6.1.2.1.1.1.0",
};

const lexmark_oids = {
  SerialNumber: "1.3.6.1.2.1.43.5.1.1.17.1", // SN,
  Uptime: "1.3.6.1.2.1.1.3.0", // Uptime
  Hostname: "1.3.6.1.2.1.1.5.0", // Hostname
  Syslocation: "1.3.6.1.2.1.1.6.0", // SysLocation
  Inventory: "1.3.6.1.4.1.641.2.1.2.1.7.1", // Inv
  Model: "1.3.6.1.4.1.641.2.1.2.1.2.1",
  FW: "1.3.6.1.4.1.641.2.1.2.1.4.1",
  MAC2: "1.3.6.1.2.1.2.2.1.6.1",
  MAC: "1.3.6.1.2.1.2.2.1.6.2",
  sysDescr: "1.3.6.1.2.1.1.1.0",
};

const vendor_check = {
  lexmark: "1.3.6.1.4.1.641.2.1.2.1.4.1",
  toshiba: "1.3.6.1.4.1.1129.1.2.1.1.1.1.2.0",
  ricoh: "1.3.6.1.4.1.367.3.2.1.1.1.2.0",
  zebra: "1.3.6.1.4.1.10642.1.7.0",
};

const vendor_oids = {
  lexmark: lexmark_oids,
  ricoh: ricoh_oids,
  toshiba: toshiba_oids,
  zebra: zebra_oids,
};

const vendor = {
  "78:8c:77": lexmark_oids,
  "00:21:b7": lexmark_oids,
  "00:04:24": toshiba_oids,
  "c8:3a:1b": toshiba_oids,
  "00:26:73": ricoh_oids, // RICOH
  "00:80:91": toshiba_oids,
  "58:38:79": ricoh_oids, // RICOH
  "00:30:ab": undefined, // DELTA NETWORKS,
  "00:00:74": ricoh_oids, // RICOH
  "00:04:24": toshiba_oids,
  "30:b5:c2": undefined, // TP_LINK
  "60:95:32": zebra_oids,
  "48:a4:93": zebra_oids,
};

const vendor_name = {
  "78:8c:77": "lexmark",
  "00:21:b7": "lexmark",
  "00:04:24": "toshiba",
  "c8:3a:1b": "toshiba",
  "00:26:73": "ricoh", // RICOH
  "00:80:91": "toshiba",
  "58:38:79": "ricoh", // RICOH
  "00:30:ab": "delta", // DELTA NETWORKS,
  "00:00:74": "ricoh", // RICOH
  "00:04:24": "toshiba",
  "30:b5:c2": "tp-link", // TP_LINK
  "60:95:32": "zebra",
  "48:a4:93": "zebra",
};

function swapped(obj) {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {});
}

const dbConfig = {
  host: "localhost",
  user: "nicola",
  password: "Agrintesa2025",
  database: "printers",
};

function setSnmpData(ip, oid, value, community = "public") {
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(ip, community);
    const varbinds = [
      {
        oid: oid,
        type: snmp.ObjectType.OctetString,
        value: value,
      },
    ];

    session.set(varbinds, (error, varbinds) => {
      if (error) {
        reject({ error: error.toString() });
      } else {
        resolve(varbinds);
      }
      session.close();
    });
  });
}

async function getSnmpData(ip, vendor, community = "public") {
  if (!vendor) return;
  //const session = snmp.createSession(ip, community);
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(ip, community);

    session.get(Object.values(vendor), (error, varbinds) => {
      log.debug(
        `ip: ${ip}, error: ${error}, varbinds: ${JSON.stringify(varbinds)}`
      );
      if (error) {
        // se lexmark è probabile che l'oid dell'inventario non venga gradito
        // facciamo la scansione a mano
        reject(error);
      } else {
        const result = {};
        varbinds.forEach((varbind) => {
          if (snmp.isVarbindError(varbind)) {
            if (snmp.varbindError(varbind) == snmp.RequestTimedOutError)
              reject(snmp.RequestTimedOutError);
          } else {
            let value = undefined;
            switch (varbind.type) {
              case snmp.ObjectType.TimeTicks:
                value = varbind.value;
                break;
              case snmp.ObjectType.OctetString:
                if (varbind.oid.startsWith(mac_prefix)) value = varbind.value;
                else value = varbind.value.toString();
                break;
              default:
                log.debug("snmp.ObjectType = " + varbind.type);
                break;
            }
            result[swapped(vendor)[varbind.oid]] = value;
          }
        });
        resolve(result);
      }
      session.close();
    });
  });
}

async function saveToIPTable(ip_array) {
  log.info("saveToIPTable: "); // + JSON.stringify(ip_array) )
  const connection = await mysql.createConnection(dbConfig);
  try {
    ip_array.forEach(async (e) => {
      const query = `
      INSERT INTO ip (ip, mac, subnet, snmp, sysDescr, firstseen, lastupd )
      VALUES (?, ?, (SELECT subnet.id
      FROM subnet
      WHERE subnet.subnet = ?), ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
         snmp = VALUES(snmp),
         sysDescr = VALUES(sysDescr),
         lastupd = NOW();
    `;

      log.debug(`ip: ${JSON.stringify(e)}`);
      await connection.execute(query, [
        e.ip,
        e.mac,
        e.subnet,
        e.snmp,
        e.sysDescr,
      ]);
      log.info("Data for ip " + e.ip + " saved to database");
    });
  } catch (err) {
    console.error("Error saving ip " + ip + " to database:", err);
    throw err;
  } finally {
    await connection.end();
  }
}

async function saveToPrinterTable(ip, mac, vendor, data) {
  const connection = await mysql.createConnection(dbConfig);
  log.info("saveToDatabase init " + JSON.stringify(data));
  try {
    const query = `
      INSERT INTO printer (SerialNumber, Uptime, Hostname, Syslocation, Inventory, Model, FW, ip, MAC, vendor, firstseen, lastupd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        Uptime = VALUES(Uptime),
        Hostname = VALUES(Hostname),
        Syslocation = VALUES(Syslocation),
        Inventory = VALUES(Inventory),
        Model = VALUES(Model),
        FW = VALUES(FW),
        ip = VALUES(ip),
        MAC = VALUES(MAC),
        vendor = VALUES(vendor),
        lastupd = NOW()
    `;

    log.info(
      `serialnumber: ${
        data.SerialNumber
      } ip ${ip} MAC ${mac} vendor ${JSON.stringify(vendor)}`
    );
    await connection.execute(query, [
      data.SerialNumber,
      data.Uptime,
      data.Hostname,
      data.Syslocation,
      data.Inventory ? data.Inventory : null,
      data.Model,
      data.FW,
      ip,
      mac,
      vendor,
    ]);
    log.info("Data for ip " + ip + " saved to database");
  } catch (err) {
    console.error("Error saving ip " + ip + " to database:", err);
    throw err;
  } finally {
    await connection.end();
  }
}

function binarytoString(mac) {
  const buffer = Buffer.from(mac, "binary");

  // Converti il buffer in un array di byte
  const ba = Array.from(buffer);

  // Formatta l'array di byte come un MAC address
  return ba.map((byte) => byte.toString(16).padStart(2, "0")).join(":");
}

app.get("/snmp", async (req, res) => {
  const ip = req.query.ip;
  if (!ip) {
    return res.status(400).json({ error: "IP address is required" });
  }

  try {
    const p = await pingus.icmp({ host: ip });
    log.debug(JSON.stringify(p, null, " "));
    if (p.status == "timeout") {
      res.status(500).send(`ip ${ip} not online`);
      return;
    }

    const udp = await pingus.udp({ host: ip, port: 161 });
    log.debug(JSON.stringify(udp, null, " "));
    if (udp.status != "open") {
      res.status(500).send(`ip ${ip} SNMP disabled ${p.status}`);
      return;
    }

    let mac = await arp.toMAC(ip);

    // apparati a valle di device cisco ritornano mac mascherati
    if (mac && mac.slice(0, 8) != "00:00:0c") {
      log.info(
        `ip: ${ip}, MAC: ${mac}, vendor: ${
          vendor_name[mac.slice(0, 8)] || "sconosciuto"
        }`
      );
      brand = vendor[mac.slice(0, 8)];

      // alcuni brand non hanno inventory -- gestiamo l'eccezione.
      // ad ora solo lexmark
      let data = undefined;
      try {
        data = await getSnmpData(ip, vendor[mac.slice(0, 8)]);
      } catch (error) {
        let vendor_noinv = Object.assign({}, vendor[mac.slice(0, 8)]);
        delete vendor_noinv.Inventory;

        data = await getSnmpData(ip, vendor_noinv);
      }

      data.MAC = mac;
      if (data.MAC2) data.MAC2 = binarytoString(data.MAC2);
      await saveToPrinterTable(ip, mac, vendor_name[mac.slice(0, 8)], data);
      data.ip = ip;
      res.json(data);
    } else {
      try {
        log.info("IP outside subnet: going for SNMP: " + ip);

        // Intanto controllo che SNMP sia attivo

        // poi verifico la marca stampante
        // 641 = lexmark
        // 367 = ricoh
        // 1129 = toshiba
        let fw = undefined;
        let brand = undefined;
        fw = await getSnmpData(ip, ["1.3.6.1.2.1.1.1.0"]);
        log.debug(JSON.stringify(fw));

        for (const [b, v] of Object.entries(vendor_check)) {
          try {
            log.debug(`b=${b}, v=${v}`);
            fw = await getSnmpData(ip, [v]);
            log.debug(`IP ${ip} brand ${b}`);
            brand = b;
            break;
          } catch (wrong_brand) {
            log.warn(`tried ${b} on ip ${ip} no match ${wrong_brand}`);
          }
        }

        if (!brand) {
          res.status(500).send("Brand not found for ip " + ip);
          return;
        }

        log.info(`ip: ${ip}, vendor: ${brand || "sconosciuto"}`);

        // alcuni brand non hanno inventory -- gestiamo l'eccezione.
        // ad ora solo lexmark
        let data = undefined;
        try {
          data = await getSnmpData(ip, vendor_oids[brand]);
        } catch {
          let vendor_noinv = Object.assign({}, vendor_oids[brand]);
          delete vendor_noinv.Inventory;
          data = await getSnmpData(ip, vendor_noinv);
        }

        data.MAC = binarytoString(data.MAC);
        if (data.MAC2) data.MAC2 = binarytoString(data.MAC2);
        await saveToPrinterTable(ip, data.MAC, brand, data);

        data.ip = ip;
        res.json(data);
      } catch (error) {
        if (error.name == "RequestTimedOutError") {
          log.info("/snmp " + error);
          res.status(400).send(error);
        }
        log.info("/snmp " + error);

        res.status(400).send(error);
      }
    }
  } catch (error) {
    log.info("IP outside subnet: going for SNMP3: " + error);

    res.status(500).json(error);
  }
});

app.get("/set", async (req, res) => {
  const { ip, inv } = req.query;
  if (!ip || !inv) {
    return res
      .status(400)
      .json({ error: "IP address and inv parameter are required" });
  }

  try {
    // const oid = "1.3.6.1.4.1.641.2.1.2.1.7.1";
    const oid = "1.3.6.1.4.1.1129.1.2.1.1.1.4.1.0"; // Inv

    await setSnmpData(ip, oid, inv);
    res.json({ message: "Value set successfully" });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

app.get("/scan", async (req, res) => {
  const { subnet, netmask } = req.query;
  if (!subnet || !netmask) {
    return res.status(400).json({ error: "Subnet and netmask are required" });
  }

  try {
    const subnetInfo = ip.cidrSubnet(`${subnet}/${netmask}`);
    const firstIp = ip.toLong(subnetInfo.firstAddress);
    const lastIp = ip.toLong(subnetInfo.lastAddress);
    const results = [];
    const ip_array = [];
    // const no_brand = [];

    const promises = [];
    for (let longIp = firstIp; longIp <= lastIp; longIp++) {
      const ipAddr = ip.fromLong(longIp);
      promises.push(
        (async () => {
          log.info("Scanning ipAddr: " + ipAddr);
          try {
            const p = await pingus.icmp({ host: ipAddr });

            if (p.status != "reply") {
              log.info(`pingus icmp error: ${ipAddr} p.status=${p.status}`);
              return;
            }

            const udp = await pingus.udp({ host: ipAddr, port: 161 });
            if (udp.status != "open") {
              log.info(`pingus udp error: ${ipAddr} p.status=${p.status}`);
              return;
            }

            log.info(`found something on ${ipAddr} p.status=${p.status}`);
            let mac = await arp.toMAC(ipAddr);
            if (mac && mac.slice(0, 8) != "00:00:0c") {
              log.info(
                `ip: ${ipAddr}, MAC: ${mac}, vendor: ${
                  vendor_name[mac.slice(0, 8)] || "sconosciuto"
                }`
              );
              let brand = vendor_name[mac.slice(0, 8)];

              // inserisco l'ip in un array per identificare brand non ancora censiti.
              // Si possono fare a mano in seguito
              if (!brand) {
                try {
                  fw = await getSnmpData(ipAddr, ["1.3.6.1.2.1.1.1.0"]);
                  ip_array.push({
                    ip: ipAddr,
                    mac: mac,
                    subnet: subnet,
                    snmp: true,
                    sysDescr: fw,
                  });
                } catch (snmp_ko) {
                  log.info(`${ipAddr} snmp disabled`);
                  ip_array.push({
                    ip: ipAddr,
                    mac: mac,
                    subnet: subnet,
                    snmp: false,
                    sysDescr: null,
                  });
                }
                return;
              }

              let data = undefined;
              try {
                data = await getSnmpData(ipAddr, vendor[mac.slice(0, 8)]);
              } catch {
                let vendor_noinv = Object.assign({}, vendor[mac.slice(0, 8)]);
                delete vendor_noinv.Inventory;
                try {
                  data = await getSnmpData(ipAddr, vendor_noinv);
                } catch (err) {
                  // siamo in un caso dove il brand stampante è noto, ma snmp disabilitato
                  log.info("printer with ip=" + ipAddr + " " + vendor[mac.slice(0, 8)] + " snmp disabled")
                  ip_array.push({
                    ip: ipAddr,
                    mac: mac,
                    subnet: subnet,
                    snmp: false,
                    sysDescr: vendor_name[mac.slice(0, 8)],
                  });
                  return;
                }
              }

              if (data) {
                data.MAC = mac;

                ip_array.push({
                  ip: ipAddr,
                  mac: mac,
                  subnet: subnet,
                  snmp: true,
                  sysDescr: data.sysDescr,
                });
                results.push({ ip: ipAddr, ...data });
                await saveToPrinterTable(ipAddr, mac, brand, data);
              } else
                ip_array.push({
                  ip: ipAddr,
                  mac: mac,
                  subnet: subnet,
                  snmp: false,
                  sysDescr: null,
                });
            } else {
              try {
                log.info("IP outside subnet: going for SNMP: " + ipAddr);
                // Intanto controllo che SNMP sia attivo

                // poi verifico la marca stampante
                // 641 = lexmark
                // 1129 = toshiba
                let fw = undefined;
                let brand = undefined;

                for (const [b, v] of Object.entries(vendor_check)) {
                  try {
                    fw = await getSnmpData(ipAddr, [v]);
                    log.info(`IP ${ipAddr} brand ${b}`);
                    brand = b;
                    break;
                  } catch (wrong_brand) {
                    if (wrong_brand.name == "RequestTimedOutError") {
                      ip_array.push({
                        ip: ipAddr,
                        mac: null,
                        subnet: subnet,
                        snmp: false,
                        sysDescr: null,
                      });
                      return;
                    }
                    log.info(`tried ${b} on ip ${ipAddr} no match`);
                  }
                }

                // inserisco l'ip in un array per identificare brand non ancora censiti.
                // Si possono fare a mano in seguito
                if (!brand) {
                  try {
                    fw = await getSnmpData(ipAddr, ["1.3.6.1.2.1.1.1.0"]);
                    ip_array.push({
                      ip: ipAddr,
                      mac: null,
                      subnet: subnet,
                      snmp: true,
                      sysDescr: fw,
                    });
                  } catch (snmp_ko) {
                    log.info(`${ipAddr} snmp disabled`);
                    ip_array.push({
                      ip: ipAddr,
                      mac: null,
                      subnet: subnet,
                      snmp: false,
                      sysDescr: null,
                    });
                  }
                  return;
                }
                log.info(`ip: ${ipAddr}, vendor: ${brand || "sconosciuto"}`);

                let data = undefined;
                try {
                  data = await getSnmpData(ipAddr, vendor_oids[brand]);
                } catch {
                  log.debug(ipAddr + " no inventory");
                  let vendor_noinv = Object.assign({}, vendor_oids[brand]);
                  delete vendor_noinv.Inventory;

                  data = await getSnmpData(ipAddr, vendor_noinv);
                }

                if (data) {
                  data.MAC = binarytoString(data.MAC);
                  if (data.MAC2) data.MAC2 = binarytoString(data.MAC2);

                  ip_array.push({
                    ip: ipAddr,
                    mac: null,
                    subnet: subnet,
                    snmp: true,
                    sysDescr: data.sysDescr,
                  });
                  results.push({ ip: ipAddr, ...data });
                  await saveToPrinterTable(ipAddr, data.MAC, brand, data);
                }
              } catch (error) {
                log.error("Errore generico " + error);
              }
            }
          } catch (error) {
            log.error(
              "IP " + ipAddr + " outside subnet: errore generico " + error
            );
          }
        })()
      );
    }

    await Promise.all(promises);
    log.info(
      `result.len = ${results.length}, ip_array.len = ${ip_array.length}`
    );
    //log.info("ip con snmp ma senza brand: " + JSON.stringify(no_brand));
    await saveToIPTable(ip_array);

    res.json({ results: results, ips: ip_array });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

app.get("/getall", async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);

  try {
    const query = `SELECT *, DATE_FORMAT(lastupd, '%H:%i:%s %d-%m-%y') AS formatted_date, DATE_FORMAT(firstseen, '%H:%i:%s %d-%m-%y') AS firstseen
                   from printers.printer order by ip`;
    const syslocation = `select syslocation from printer group by syslocation order by syslocation`;
    const fw = `select FW from printer group by FW order by FW`;
    const model = `select model from printer group by model order by model`;
    // const lastupdate = `select syslocation from printer group by syslocation order by syslocation`;
    const vendor = `select vendor from printer group by vendor order by vendor`;
    // const firstseen = `select model from printer group by model order by model`;
    const count = `SELECT count(*) as count FROM printers.printer;`;
    const subnet = `SELECT * from printers.subnet order by inet_aton(subnet)`;
    const [syslocation_rows, fields1] = await connection.query(syslocation);
    const [fw_rows, fields2] = await connection.query(fw);
    const [model_rows, fields3] = await connection.query(model);
    const [vendor_rows, fields4] = await connection.query(vendor);
    const [count_rows, fields5] = await connection.query(count);
    const [rows, fields] = await connection.query(query);
    const [subnet_rows, fields6] = await connection.query(subnet);

    res.json({
      printers: rows,
      syslocation: syslocation_rows,
      fw: fw_rows,
      model: model_rows,
      vendor: vendor_rows,
      count: count_rows,
      subnet: subnet_rows,
    });
  } catch (error) {
    log.info(error);
    res.status(500).json({ error: error.toString() });
  } finally {
    await connection.end();
  }
});

// Avvia il server sulla porta 5000
server.listen(5000, () => {
  log.info("Server is listening on port 5000");
});
