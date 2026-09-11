use rs_utcp::{
    config::UtcpClientConfig,
    repository::in_memory::InMemoryToolRepository,
    tag::tag_search::TagSearchStrategy,
    UtcpClient, UtcpClientInterface,
};
use std::{collections::HashMap, sync::Arc};
use serde_json::json;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = UtcpClientConfig::new()
        .with_manual_path("tools.manual.json".into());
    let repo = Arc::new(InMemoryToolRepository::new());
    let search = Arc::new(TagSearchStrategy::new(repo.clone(), 1.0));
    let client = UtcpClient::create(config, repo, search).await?;

    let args = HashMap::from([
        ("name".to_string(), json!("Rust")),
    ]);
    let result = client.call_tool("local.hello", args).await?;
    println!("{result}");
    Ok(())
}
