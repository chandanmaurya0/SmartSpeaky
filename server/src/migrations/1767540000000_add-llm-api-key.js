export const up = pgm => {
  pgm.addColumns('llm_settings', {
    llm_api_key: {
      type: 'text',
      default: '',
    },
  })
}

export const down = pgm => {
  pgm.dropColumns('llm_settings', ['llm_api_key'])
}
