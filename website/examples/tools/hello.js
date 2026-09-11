const { name = 'Rust' } = JSON.parse(process.argv[2] || '{}');
console.log(JSON.stringify({ message: 'Hello, ' + name + '!' }));
