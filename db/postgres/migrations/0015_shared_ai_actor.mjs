/** Current heads adopt one shared AI actor. Historical bodies and receipts stay byte-for-byte. */
export async function apply(client) {
  const rows = (await client.query('SELECT user_id,id,body FROM state.collaborations ORDER BY user_id,id')).rows;
  for (const row of rows) {
    const record = JSON.parse(row.body);
    record.delegation = {mode: 'any_ai', client_id: null};
    if (record.run_actor?.kind === 'client') {
      record.run_actor = {kind: 'client', client_id: 'shared-ai', connection_id: 'shared-ai'};
    }
    await client.query('UPDATE state.collaborations SET body=$3 WHERE user_id=$1 AND id=$2',
      [row.user_id, row.id, JSON.stringify(record)]);
  }
}
