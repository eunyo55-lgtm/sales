const { execSync } = require('child_process');

try {
    console.log('Converting Blue Rocket icon...');
    execSync('npx -y png-to-ico "C:\\Users\\onlin\\.gemini\\antigravity\\brain\\9ea5969e-22ef-4a71-baed-b68cffb88098\\coupang_blue_rocket_1773191142797.png" > "C:\\Users\\onlin\\Desktop\\Sales\\scraper\\coupang_icon_v3.ico"');

    console.log('Finished converting blue rocket icon.');
} catch (e) {
    console.error('Error during conversion:', e.message);
}
