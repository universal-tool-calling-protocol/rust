// Examples follow this repository's rs-utcp 0.3.2 API and ManualV1 format.
export const REPOSITORY = 'https://github.com/universal-tool-calling-protocol/rs-utcp';
export const VERSION = '0.3.2';

export const dependencies = `[dependencies]
rs-utcp = "${VERSION}"
tokio = { version = "1", features = ["full"] }
serde_json = "1"
anyhow = "1"`;

const imports = `use rs_utcp::{
    config::UtcpClientConfig,
    repository::in_memory::InMemoryToolRepository,
    tag::tag_search::TagSearchStrategy,
    UtcpClient, UtcpClientInterface,
};
use std::{collections::HashMap, sync::Arc};
use serde_json::json;`;

const clientSetup = (filename) => `    let config = UtcpClientConfig::new()
        .with_manual_path("${filename}".into());
    let repo = Arc::new(InMemoryToolRepository::new());
    let search = Arc::new(TagSearchStrategy::new(repo.clone(), 1.0));
    let client = UtcpClient::create(config, repo, search).await?;`;

function transportExample({ type, name, tool, description, args, template, streaming = false }) {
  const properties = Object.fromEntries(Object.entries(args).map(([key, value]) => [key, {
    type: typeof value === 'number' ? 'integer' : typeof value,
  }]));
  const manual = JSON.stringify({
    manual_version: '1.0.0',
    utcp_version: '1.0.0',
    info: { title: name + ' tools', version: '1.0.0' },
    allowed_communication_protocols: [type],
    tools: [{
      name: tool, description,
      inputs: { type: 'object', properties, required: Object.keys(properties) },
      outputs: { type: 'object' },
      tags: [type, 'demo'],
      tool_call_template: { call_template_type: type, name, ...template },
    }],
  }, null, 2);
  const filename = type + '.manual.json';
  const toolName = name + '.' + tool;
  const rustArgs = Object.entries(args).map(([key, value]) =>
    `        ("${key}".to_string(), json!(${JSON.stringify(value)})),`).join('\n');
  const argumentMap = Object.keys(args).length ? `HashMap::from([\n${rustArgs}\n    ])` : 'HashMap::new()';
  const call = streaming
    ? `    let mut stream = client.call_tool_stream("${toolName}", args).await?;
    let result: anyhow::Result<()> = async {
        while let Some(item) = stream.next().await? {
            println!("{item}");
        }
        Ok(())
    }.await;
    stream.close().await?;
    result?;`
    : `    let result = client.call_tool("${toolName}", args).await?;
    println!("{result}");`;
  const rhaiMap = '#{ ' + Object.entries(args).map(([key, value]) => key + ': ' + JSON.stringify(value)).join(', ') + ' }';
  return {
    manual,
    code: `${imports}

// Save the Manual tab as ${filename}.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
${clientSetup(filename)}
    let args = ${argumentMap};
${call}
    Ok(())
}`,
    codeMode: `${imports.replace('    UtcpClient, UtcpClientInterface,', '    UtcpClient,').replace('use std::{collections::HashMap, sync::Arc};\nuse serde_json::json;', 'use std::sync::Arc;')}
use rs_utcp::plugins::codemode::{CodeModeArgs, CodeModeUtcp};

// Save the Manual tab as ${filename}.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
${clientSetup(filename)}
    let codemode = CodeModeUtcp::new(Arc::new(client));
    // The embedded workflow is Rhai, hosted by Rust.
    let result = codemode.execute(CodeModeArgs {
        code: r#"
            ${streaming ? 'call_tool_stream' : 'call_tool'}("${toolName}", ${rhaiMap})
        "#.to_string(),
        timeout: Some(5_000),
    }).await?;
    println!("{}", result.value);
    Ok(())
}`,
  };
}

export const protocols = [
  {
    id: 'http', name: 'HTTP', icon: 'globe', category: 'The everyday essential',
    title: 'Your APIs, connected.',
    description: 'Turn REST endpoints into discoverable tools. Describe an endpoint in a UTCP manual or convert an OpenAPI document, then call your API directly.',
    tags: ['REST & OpenAPI', 'JSON requests', 'Authentication'],
    note: 'Replace the example URL with a POST endpoint accepting a JSON body.',
    ...transportExample({ type: 'http', name: 'weather', tool: 'forecast', description: 'Get the forecast for a city.',
      args: { city: 'Warsaw', days: 3 }, template: { url: 'https://api.example.com/forecast', http_method: 'POST' } }),
  },
  {
    id: 'sse', name: 'SSE', icon: 'radio', category: 'Keep the conversation flowing',
    title: 'Events as they happen.',
    description: 'Consume Server-Sent Events through an async stream. Process updates as they arrive, and close the stream when your work is done.',
    tags: ['Server-Sent Events', 'Async iteration', 'Live updates'],
    note: 'Use a compatible SSE tool server; this example expects a finite stream.',
    ...transportExample({ type: 'sse', name: 'events', tool: 'watch', description: 'Stream updates for a topic.', streaming: true,
      args: { topic: 'builds', limit: 3 }, template: { url: 'https://api.example.com/events' } }),
  },
  {
    id: 'http_stream', name: 'HTTP Streams', icon: 'stream', category: 'A little at a time',
    title: 'Built for the stream.',
    description: 'Receive incremental results over HTTP. Pull each JSON value through the same StreamResult interface used by the other streaming protocols.',
    tags: ['Chunked HTTP', 'Incremental JSON', 'Async results'],
    note: 'The Rust call template type is http_stream. Use a matching tool server.',
    ...transportExample({ type: 'http_stream', name: 'tokens', tool: 'generate', description: 'Stream generated tokens.', streaming: true,
      args: { prompt: 'Explain UTCP', max_tokens: 32 }, template: { url: 'https://api.example.com', http_method: 'POST' } }),
  },
  {
    id: 'websocket', name: 'WebSocket', icon: 'activity', category: 'A connection that stays open',
    title: 'Stay in the loop.',
    description: 'Exchange tool calls over a persistent WebSocket connection. Connect real-time services to the same client you use for ordinary requests.',
    tags: ['Bidirectional', 'Persistent connections', 'WSS'],
    note: 'The endpoint must understand the UTCP WebSocket message format.',
    ...transportExample({ type: 'websocket', name: 'realtime', tool: 'echo', description: 'Echo a message over WebSocket.',
      args: { message: 'Hello from Rust!' }, template: { url: 'wss://api.example.com/tools', keep_alive: true } }),
  },
  {
    id: 'grpc', name: 'gRPC', icon: 'layers', category: 'A compact, typed connection',
    title: 'Meet your RPC services.',
    description: 'Discover and invoke tools through the UTCP protobuf service. Tonic powers unary calls and server streams, with TLS and authentication metadata support.',
    tags: ['Tonic & Protobuf', 'Server streaming', 'TLS'],
    note: 'Use a server implementing the UTCP protobuf service in this repository.',
    ...transportExample({ type: 'grpc', name: 'rpc', tool: 'watch', description: 'Stream topic updates.', streaming: true,
      args: { topic: 'builds', limit: 3 }, template: { host: 'api.example.com', port: 443, use_ssl: true } }),
  },
  {
    id: 'graphql', name: 'GraphQL', icon: 'graphql', category: 'A schema you already know',
    title: 'Give your queries a client.',
    description: 'Call GraphQL operations with a named query or mutation. Map tool arguments to GraphQL variables while keeping the same Rust call interface.',
    tags: ['Queries & mutations', 'Variables', 'Schema discovery'],
    note: 'Match the operation name and argument types to your GraphQL schema.',
    ...transportExample({ type: 'graphql', name: 'graph', tool: 'hello', description: 'Return a greeting from GraphQL.',
      args: { name: 'Rust' }, template: { url: 'https://api.example.com/graphql', operation_type: 'query', operation_name: 'hello' } }),
  },
  {
    id: 'cli', name: 'CLI', icon: 'terminal', category: 'The command line is an API, too',
    title: 'Put your commands to work.',
    description: 'Wrap a local command in a tool call. Pass arguments, a working directory, and environment variables to programs implementing the UTCP CLI convention.',
    tags: ['Local processes', 'JSON input', 'Environment variables'],
    note: 'The program receives: call <provider> <tool>, argument flags, and JSON stdin.',
    ...transportExample({ type: 'cli', name: 'shell', tool: 'greet', description: 'Ask a local UTCP command to return a greeting.',
      args: { name: 'Rust' }, template: { command: 'python3 tools/cli_server.py' } }),
  },
  {
    id: 'tcp', name: 'TCP', icon: 'network', category: 'Down to the socket',
    title: 'A direct line to tools.',
    description: 'Connect to socket services with the TCP transport. Send framed JSON tool calls, receive results, and set a timeout for the connection.',
    tags: ['Framed JSON', 'Socket transport', 'Timeouts'],
    note: 'Use a server implementing the TCP framing and messages from the examples.',
    ...transportExample({ type: 'tcp', name: 'socket', tool: 'echo', description: 'Echo a message through a TCP tool server.',
      args: { message: 'Hello over TCP' }, template: { host: '127.0.0.1', port: 9000, timeout_ms: 5_000 } }),
  },
  {
    id: 'udp', name: 'UDP', icon: 'send', category: 'Small messages, simple calls',
    title: 'Tools by datagram.',
    description: 'Send lightweight tool calls over UDP. Configure the destination and response timeout for services that communicate through datagrams.',
    tags: ['Datagrams', 'JSON messages', 'Response timeout'],
    note: 'Use a compatible UDP tool server listening on the configured port.',
    ...transportExample({ type: 'udp', name: 'datagrams', tool: 'echo', description: 'Echo a message through a UDP tool server.',
      args: { message: 'Hello over UDP' }, template: { host: '127.0.0.1', port: 9001, timeout_ms: 5_000 } }),
  },
  {
    id: 'webrtc', name: 'WebRTC', icon: 'peers', category: 'Make a peer-to-peer connection',
    title: 'Let your peers talk.',
    description: 'Call tools over a WebRTC DataChannel. Configure signaling, ICE servers, and delivery settings to connect peers through the Rust client.',
    tags: ['DataChannels', 'Peer connections', 'STUN & TURN'],
    note: 'Start the repository’s WebRTC signaling server and matching tool peer first.',
    ...transportExample({ type: 'webrtc', name: 'peer', tool: 'echo', description: 'Echo a message through a peer DataChannel.',
      args: { message: 'Hello from this peer' }, template: { signaling_server: 'http://127.0.0.1:8080', channel_label: 'utcp-data', ordered: true } }),
  },
  {
    id: 'mcp', name: 'MCP', icon: 'connect', category: 'Bring your existing tools along',
    title: 'An open door to MCP.',
    description: 'Connect to Model Context Protocol servers and use their tools alongside your other integrations. Configure an HTTP URL or a local stdio process.',
    tags: ['stdio & HTTP', 'Tool discovery', 'Existing servers'],
    note: 'Provide calculator_server.py with an MCP add tool accepting a and b.',
    ...transportExample({ type: 'mcp', name: 'calculator', tool: 'add', description: 'Add two numbers through MCP.',
      args: { a: 5, b: 3 }, template: { command: 'python3', args: ['calculator_server.py'] } }),
  },
  {
    id: 'text', name: 'Text', icon: 'file', category: 'Local tools, a familiar interface',
    title: 'Start with a script.',
    description: 'Expose local JavaScript, Python, shell scripts, or executables as tools. Pass JSON arguments and receive their output through the Rust client.',
    tags: ['File-backed tools', 'JSON arguments', 'Local execution'],
    note: 'Save the quick start’s hello.js in tools/ and have Node.js on PATH.',
    ...transportExample({ type: 'text', name: 'local', tool: 'hello', description: 'Return a greeting from a local script.',
      args: { name: 'Rust' }, template: { base_path: './tools' } }),
  },
];

export const quickstart = `${imports}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
${clientSetup('tools.manual.json')}

    let args = HashMap::from([
        ("name".to_string(), json!("Rust")),
    ]);
    let result = client.call_tool("local.hello", args).await?;
    println!("{result}");
    Ok(())
}`;

export const helloScript = `const { name = 'Rust' } = JSON.parse(process.argv[2] || '{}');
console.log(JSON.stringify({ message: 'Hello, ' + name + '!' }));`;
export const localManual = protocols.find((protocol) => protocol.id === 'text').manual;

const paragraph = (text) => ({ type: 'paragraph', text });
const heading = (title) => ({ type: 'heading', title });
const code = (label, source) => ({ type: 'code', label, code: source });

export const docs = [
  {
    id: 'quickstart', name: 'Quick start', icon: 'terminal',
    description: 'Install the crate and make your first local tool call.',
    keywords: 'getting started installation cargo rust tokio dependencies setup greeting hello local example',
    intro: 'A Rust client, a small manual, and your first tool call. Start locally, then use the same API for the rest of your stack.',
    blocks: [
      heading('1. Create your Rust application'),
      paragraph('Use a current stable Rust toolchain, a C/C++ build toolchain, and <code>protoc</code> (the Protocol Buffers compiler). The crate’s build script generates its gRPC bindings. This local greeting example also uses Node.js to run a tool script.'),
      code('Terminal', 'cargo new utcp-hello\ncd utcp-hello\ncargo add rs-utcp\ncargo add tokio --features full\ncargo add serde_json anyhow\nmkdir tools'),
      code('Cargo.toml · dependencies', dependencies),
      heading('2. Give the client a local tool'),
      paragraph('Save this script as <code>tools/hello.js</code>. The Text transport passes tool arguments as JSON in the first script argument and reads the result from standard output.'),
      code('tools/hello.js', helloScript),
      paragraph('Save the following manual as <code>tools.manual.json</code> in your new project. The call template names the provider <code>local</code>, making the tool available as <code>local.hello</code>.'),
      code('tools.manual.json', localManual),
      heading('3. Discover and call'),
      paragraph('Replace <code>src/main.rs</code> with this complete program. The client loads the manual during creation, stores its tool in the repository, and dispatches the call to the Text transport.'),
      code('src/main.rs', quickstart),
      code('Terminal', 'cargo run\n# The result includes: {"message":"Hello, Rust!"}'),
      paragraph('You can also download <a href="./examples/main.rs" download>main.rs</a>, <a href="./examples/tools.manual.json" download>tools.manual.json</a>, and <a href="./examples/tools/hello.js" download>hello.js</a>. Place them in the paths above. For an HTTP endpoint, start with the <a href="./?protocol=http#protocols">HTTP manual and Rust example</a>.'),
    ],
  },
  {
    id: 'discovery', name: 'Discovery & search', icon: 'scan',
    description: 'Load manuals, search tools, and convert OpenAPI documents.',
    keywords: 'manual openapi swagger discover search repository tags tools client configuration',
    intro: 'Describe what your tools do and how to reach them. The client gives your application a searchable tool catalog.',
    blocks: [
      heading('A manual describes the connection'),
      paragraph('The Rust <code>ManualV1</code> format includes <code>manual_version</code>, <code>utcp_version</code>, <code>info</code>, and <code>tools</code>. Each tool supplies its name, description, input and output schemas, and native <code>tool_call_template</code>.'),
      paragraph('Use <code>UtcpClientConfig::new().with_manual_path(...)</code> to load a local JSON file. An embedded tool is registered under its provider name, such as <code>weather.forecast</code>. Give call templates explicit names when writing manuals.'),
      heading('Find a tool by its tags'),
      paragraph('Create a <code>TagSearchStrategy</code> with the same repository you pass to the client. Search takes a query and a result limit.'),
      code('After creating the quick start client', 'let tools = client.search_tools("demo", 5).await?;\nfor tool in tools {\n    println!("{}: {}", tool.name, tool.description);\n}'),
      heading('Discover from a remote provider'),
      paragraph('A provider configuration can use <code>manual_call_templates</code> instead of an embedded list of tools. Save this configuration and pass its path to the client; the HTTP provider fetches the remote manual.'),
      code('providers.json', JSON.stringify({ manual_call_templates: [{ call_template_type: 'http', name: 'weather', url: 'https://api.example.com/utcp', http_method: 'GET' }] }, null, 2)),
      heading('Reuse an OpenAPI document'),
      paragraph('Use the converter to turn a supported OpenAPI document into a UTCP manual. Inspect the resulting tools and their generated names before calling them.'),
      code('Inside an async function', 'use rs_utcp::openapi::OpenApiConverter;\n\nlet converter = OpenApiConverter::new_from_url(\n    "https://api.example.com/openapi.json",\n    Some("api".to_string()),\n).await?;\nlet manual = converter.convert();\nprintln!("Discovered {} tools", manual.tools.len());'),
      paragraph('See the <a href="https://docs.rs/rs-utcp">API reference on docs.rs</a> for repository and search interfaces.'),
    ],
  },
  {
    id: 'transports', name: 'Transports', icon: 'network',
    description: 'Explore all 12 native communication protocols.',
    keywords: 'http sse http_stream websocket grpc graphql cli tcp udp webrtc mcp text protocol',
    intro: 'One async Rust client, twelve native protocols. Choose the connection your tool already understands.',
    blocks: [
      paragraph('A call template’s <code>call_template_type</code> selects the protocol. The protocol explorer includes a manual, a complete Rust caller, and a Rust-hosted Rhai workflow for each connection.'),
      { type: 'transports' },
      heading('Run the examples'),
      paragraph('Network snippets need a server that supports the selected transport’s message format. Example hostnames are placeholders. The <a href="' + REPOSITORY + '/tree/main/examples">repository examples</a> include client and server implementations you can adapt.'),
      code('Terminal · in the Rust repository', 'cargo run --example basic_usage\n\n# WebRTC: run in separate terminals\ncargo run --example webrtc_server\ncargo run --example webrtc_client'),
      { type: 'callout', title: 'Local manuals and local tools', text: 'Read a local JSON manual with <code>with_manual_path</code>. The <code>text</code> transport executes scripts under <code>base_path</code>; it does not return a static text string. Follow the <a href="./docs.html">local quick start</a> for a complete example.' },
    ],
  },
  {
    id: 'authentication', name: 'Authentication', icon: 'key',
    description: 'Configure API keys and keep credentials in your environment.',
    keywords: 'auth authentication api key oauth oauth2 basic secret token variables environment',
    intro: 'Configure credentials with the provider that uses them. Keep secrets out of source files and tool examples.',
    blocks: [
      heading('API key authentication'),
      paragraph('For an HTTP provider, the <code>auth</code> object can place a key in a named header. The loader resolves <code>${API_KEY}</code> from configured variables or the process environment.'),
      code('providers.json', JSON.stringify({ manual_call_templates: [{ call_template_type: 'http', name: 'secure_api', url: 'https://api.example.com/utcp', http_method: 'GET', auth: { auth_type: 'api_key', api_key: '${API_KEY}', var_name: 'X-API-Key', location: 'header' } }] }, null, 2)),
      heading('Inline configuration variables'),
      code('Configure before creating the client', 'let config = UtcpClientConfig::new()\n    .with_manual_path("providers.json".into())\n    .with_variable("API_KEY".to_string(), std::env::var("API_KEY")?);'),
      heading('Choose authentication for the transport'),
      { type: 'list', items: ['The crate models API key, Basic, and OAuth2 authentication. Transport implementations determine the supported fields and flow.', 'HTTP provider <code>headers</code> can supply a bearer Authorization header.', 'MCP stdio and CLI providers can pass credentials through <code>env_vars</code>.', 'For custom protocols, implement authentication in the protocol or service layer.'] },
      paragraph('Check the <a href="https://docs.rs/rs-utcp/latest/rs_utcp/auth/index.html">authentication types</a> and the relevant provider implementation for the exact configuration.'),
    ],
  },
  {
    id: 'security', name: 'Security & limits', icon: 'shield',
    description: 'Use explicit protocol boundaries and bounded workflows.',
    keywords: 'security allowlist allow-list allowed protocols timeout limits rhai sandbox',
    intro: 'Choose which protocols a manual can use, and set execution boundaries that fit your application.',
    blocks: [
      heading('Make protocol choices explicit'),
      paragraph('Set <code>allowed_communication_protocols</code> on a manual to constrain the tool protocols it can register. With no explicit list, providers default to their own protocol type. The client checks allowed protocols again when calling a resolved tool.'),
      code('A manual allowing two protocols', '"allowed_communication_protocols": ["http", "mcp"]'),
      heading('Local tools execute local programs'),
      paragraph('CLI and Text tools start processes on the host. Use manuals and scripts you trust, and only enable these protocols where your application needs them. A Code Mode script can invoke the tools available to its client.'),
      heading('Bound Code Mode execution'),
      paragraph('The Rhai engine caps operations, expression depth, collection sizes, and script output. Code Mode defaults to a 5,000 ms timeout. Pass <code>CodeModeArgs.timeout</code> explicitly for your workflow; the current implementation accepts up to 45,000 ms.'),
      code('CodeModeArgs', 'CodeModeArgs {\n    code: script.to_string(),\n    timeout: Some(5_000),\n}'),
      { type: 'callout', title: 'Limits belong to the implementation', text: 'Transport and script limits are different. Check the <a href="' + REPOSITORY + '/blob/main/SECURITY.md">security documentation</a> and <a href="' + REPOSITORY + '/blob/main/src/plugins/codemode/mod.rs">Code Mode implementation</a> when choosing limits for production.' },
    ],
  },
  {
    id: 'streaming', name: 'Working with streams', icon: 'radio',
    description: 'Consume incremental results with async next and close.',
    keywords: 'stream streaming next close async sse events http grpc websocket rhai',
    intro: 'Process events, chunks, or tokens as they arrive. The Rust client returns a StreamResult with an explicit async lifecycle.',
    blocks: [
      heading('Pull the next value'),
      paragraph('Call <code>call_tool_stream</code> on a registered streaming tool. Its <code>next().await</code> returns <code>Result&lt;Option&lt;Value&gt;&gt;</code>: a value, end of stream, or an error.'),
      code('After registering the SSE manual', 'let mut stream = client.call_tool_stream(\n    "events.watch",\n    HashMap::from([("topic".to_string(), json!("builds"))]),\n).await?;\n\nlet result: anyhow::Result<()> = async {\n    while let Some(event) = stream.next().await? {\n        println!("{event}");\n    }\n    Ok(())\n}.await;\n\nstream.close().await?;\nresult?;'),
      heading('Close after reading'),
      paragraph('Call <code>close().await?</code> when you finish, including after a read error or early stop. The pattern above keeps the read result so the close operation happens before it propagates an error.'),
      heading('Collect a finite stream in Code Mode'),
      paragraph('Within a Rhai workflow, <code>call_tool_stream</code> collects values into an array. Use it with a finite stream; the current runtime caps collection at 10,000 items.'),
      code('Rhai · inside CodeModeArgs.code', 'let events = call_tool_stream("events.watch", #{ topic: "builds", limit: 3 });\n#{ events: events, count: events.len() }'),
      paragraph('Try the <a href="./?protocol=sse#protocols">SSE examples</a> or <a href="./?protocol=grpc#protocols">gRPC examples</a> for complete Rust programs.'),
    ],
  },
  {
    id: 'code-mode', name: 'Code Mode', icon: 'code',
    description: 'Compose tool calls with Rhai workflows hosted by Rust.',
    keywords: 'codemode code mode rhai llm ai agent workflow orchestrator execute prompt script',
    intro: 'Compose several tool calls in one small workflow. Rust hosts the client; Rhai describes the steps.',
    blocks: [
      heading('Wrap your existing client'),
      paragraph('Pass an <code>Arc</code> containing your client to <code>CodeModeUtcp::new</code>. Submit a Rhai script with <code>CodeModeArgs</code>. The last expression becomes <code>result.value</code>.'),
      code('After creating the quick start client', 'use rs_utcp::plugins::codemode::{CodeModeArgs, CodeModeUtcp};\n\nlet codemode = CodeModeUtcp::new(Arc::new(client));\nlet result = codemode.execute(CodeModeArgs {\n    code: r#"\n        let first = call_tool("local.hello", #{ name: "Rust" });\n        let second = call_tool("local.hello", #{ name: "UTCP" });\n        #{ greetings: [first, second], count: 2 }\n    "#.to_string(),\n    timeout: Some(5_000),\n}).await?;\nprintln!("{}", result.value);'),
      heading('Discover, call, and transform'),
      { type: 'flow', items: ['Find tools', 'Write Rhai', 'Call with UTCP', 'Return a value'] },
      paragraph('Inside a workflow, <code>search_tools(query, limit)</code> finds tools, <code>call_tool(name, args)</code> calls one, and <code>call_tool_stream(name, args)</code> collects a finite stream. Rhai object maps use <code>#{ ... }</code>.'),
      code('Rhai workflow', 'let matches = search_tools("demo", 5);\nlet greeting = call_tool("local.hello", #{ name: "Rust" });\n#{ discovered: matches.len(), greeting: greeting }'),
      heading('Connect an LLM'),
      paragraph('The repository includes a <code>CodemodeOrchestrator</code> and an LLM model interface. Its workflow decides whether tools are needed, selects relevant tools, generates Rhai, and executes the script. The <a href="' + REPOSITORY + '/blob/main/examples/orchestrator_gemini.rs">Gemini orchestrator example</a> shows a complete integration.'),
      { type: 'callout', title: 'Rhai source, inside a Rust application', text: 'The workflow is interpreted Rhai. Rust imports, <code>#[tokio::main]</code>, and client setup belong in the host program. Use the explorer’s <strong>Code Mode</strong> tab for complete host examples and see <a href="./docs.html?topic=security">Security &amp; limits</a> for runtime boundaries.' },
    ],
  },
  {
    id: 'contributing', name: 'Contributing', icon: 'github',
    description: 'Run examples, report issues, and contribute to rs-utcp.',
    keywords: 'contributing contribute github source license mit apache community tests examples issues rust',
    intro: 'Rust UTCP is open source under MIT or Apache-2.0. Help improve the client, share an example, or make the documentation clearer.',
    blocks: [
      heading('Explore the project'),
      paragraph('The <a href="' + REPOSITORY + '">GitHub repository</a> contains the client, protocol implementations, tests, benchmarks, and runnable examples. Start with a transport close to your use case.'),
      code('Terminal', 'git clone ' + REPOSITORY + '.git\ncd rs-utcp\ncargo test\ncargo fmt --check\ncargo clippy'),
      heading('Ways to help'),
      { type: 'list', items: ['Report a reproducible issue with your Rust version, transport, and a small example.', 'Improve the protocol documentation or add a working integration.', 'Add a focused regression test alongside a bug fix.', 'Discuss new transports and larger changes with the maintainers.'] },
      heading('Work on this website'),
      paragraph('The website lives in <code>website/</code> and uses HTML, CSS, and JavaScript. Run these commands from the repository root with Node.js 20 or newer; no package installation is needed.'),
      code('Terminal', 'npm run dev\nnpm run check\nnpm run build\nnpm run preview'),
      paragraph('Browse <a href="' + REPOSITORY + '/issues">issues on GitHub</a>, read the <a href="https://docs.rs/rs-utcp">Rust API reference</a>, or explore the broader <a href="https://www.utcp.io">Universal Tool Calling Protocol</a>.'),
    ],
  },
];
