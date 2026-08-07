const forge = require('node-forge');
const fs = require('fs');

console.log('Generating RSA keys...');
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 25); // 25 years

const attrs = [{
  name: 'commonName',
  value: 'ChatApp'
}, {
  name: 'countryName',
  value: 'ID'
}, {
  shortName: 'ST',
  value: 'DKI'
}, {
  name: 'localityName',
  value: 'Jakarta'
}, {
  name: 'organizationName',
  value: 'ChatApp'
}, {
  shortName: 'OU',
  value: 'ChatApp'
}];

cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey, forge.md.sha256.create());

console.log('Exporting PKCS12...');
const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey, [cert], 'chatapp123',
  { generateLocalKeyId: true, friendlyName: 'chatapp' }
);
const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

fs.writeFileSync('frontend/android/app/chatapp.p12', p12Der, 'binary');
console.log('Keystore generated at frontend/android/app/chatapp.p12');
