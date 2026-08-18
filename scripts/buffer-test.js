const BUFFER_API_KEY = process.env.BUFFER_API_KEY;

if (!BUFFER_API_KEY) {
  throw new Error("BUFFER_API_KEY is missing");
}

async function bufferQuery(query, variables = {}) {
  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BUFFER_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const data = await response.json();

  if (data.errors) {
    console.error(JSON.stringify(data.errors, null, 2));
    throw new Error("Buffer API error");
  }

  return data.data;
}

async function main() {
  console.log("🔵 Testing Buffer connection...\n");

  const accountData = await bufferQuery(`
    query GetAccount {
      account {
        organizations {
          id
          name
        }
      }
    }
  `);

  console.log("✅ BUFFER ORGANIZATIONS");
  console.log(JSON.stringify(accountData, null, 2));

  const organizations =
    accountData?.account?.organizations || [];

  if (!organizations.length) {
    throw new Error("No Buffer organization found");
  }

  const organizationId = organizations[0].id;

  const channelsData = await bufferQuery(
    `
      query GetChannels($organizationId: OrganizationId!) {
        channels(
          input: {
            organizationId: $organizationId
          }
        ) {
          id
          name
          displayName
          service
          isQueuePaused
        }
      }
    `,
    {
      organizationId,
    }
  );

  console.log("\n📱 BUFFER CHANNELS");
  console.log(JSON.stringify(channelsData, null, 2));

  console.log("\n✅ Buffer connection successful.");
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
