/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = pgm => {
  pgm.createTable('interaction_timings', {
    id: { type: 'uuid', primaryKey: true },
    interaction_id: { type: 'uuid', notNull: true },
    user_id: { type: 'string', notNull: true }, // Auth0 ID
    event_name: { type: 'string', notNull: true },
    duration_ms: { type: 'double precision' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })

  pgm.createIndex('interaction_timings', 'interaction_id')
  pgm.createIndex('interaction_timings', 'user_id')
}

exports.down = pgm => {
  pgm.dropTable('interaction_timings')
}
