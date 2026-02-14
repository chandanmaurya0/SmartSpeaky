import { ipcMain } from 'electron'

export function registerDevIPC() {
  ipcMain.handle('dev:revert-last-migration', async () => {
    console.log(
      'Received dev:revert-last-migration IPC call - NO-OP in API Mode.',
    )
    return { success: true }
  })

  ipcMain.handle('dev:wipe-database', async () => {
    console.log('Received dev:wipe-database IPC call - NO-OP in API Mode.')
    return { success: true }
  })
}
