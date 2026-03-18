import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = __dirname
const port = Number(process.env.CLIENT_TEST_PORT ?? 4173)

const MIME_BY_EXT = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon'
}

const resolveSafePath = (requestPath) => {
    const normalized = decodeURIComponent(requestPath.split('?')[0])
    const targetPath = normalized === '/' ? '/index.html' : normalized
    const absolutePath = path.normalize(path.join(rootDir, targetPath))

    if (!absolutePath.startsWith(rootDir)) {
        return null
    }

    return absolutePath
}

const server = createServer(async (req, res) => {
    const method = req.method ?? 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Method Not Allowed')
        return
    }

    const requestUrl = req.url ?? '/'
    const filePath = resolveSafePath(requestUrl)
    if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Forbidden')
        return
    }

    try {
        await access(filePath)
        const fileStat = await stat(filePath)

        if (fileStat.isDirectory()) {
            res.writeHead(301, { Location: `${requestUrl.replace(/\/$/, '')}/index.html` })
            res.end()
            return
        }

        const ext = path.extname(filePath).toLowerCase()
        const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': contentType })

        if (method === 'HEAD') {
            res.end()
            return
        }

        createReadStream(filePath).pipe(res)
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Not Found')
    }
})

server.listen(port, () => {
    const url = `http://localhost:${port}`
    console.log(`[client-test] Serving ${rootDir}`)
    console.log(`[client-test] Open ${url}`)
    console.log('[client-test] Press Ctrl+C to stop')
})
