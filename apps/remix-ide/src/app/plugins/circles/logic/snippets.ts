import {
  buildLinkDraft,
  canonicaliseLink,
  insertIntoHead,
  loadIndex,
  loadProfileOrInit,
  rebaseAndSaveProfile,
  saveHeadAndIndex,
  type CustomDataLink,
  type ProfilesBindings,
  type Cid
} from '@circles-profile/core'
import { CirclesPluginConfig, CirclesSnippetPayload, CirclesSnippetSummary } from '../types'
import { isRecord, toErrorMessage } from '../utils'
import { getSafeSigner } from './sdk'

export async function saveSnippet(
  config: CirclesPluginConfig,
  text: string,
  opts: {
    title?: string
    language?: string
    file?: string
    workspace?: string
  },
  avatar: string,
  bindings: ProfilesBindings,
  call: (name: string, method: string, ...args: any[]) => Promise<any>,
  emit: (name: string, ...args: any[]) => void
): Promise<{ snippetCid: string; linkName: string; txHash?: string }> {
  try {
    const isEmpty = !text || text.trim().length === 0
    if (isEmpty) {
      await call('notification', 'toast', 'No code selected')
      throw new Error('No code selected')
    }

    const signer = await getSafeSigner(config, avatar, call)

    const activeFile = await call('fileManager', 'getCurrentFile')
    const file = typeof opts.file === 'string' ? opts.file : typeof activeFile === 'string' ? activeFile : undefined

    const nowSec = Math.floor(Date.now() / 1000)
    const snippet: CirclesSnippetPayload = {
      '@context': 'https://aboutcircles.com/contexts/circles-gist/',
      '@type': 'Snippet',
      content: text,
      createdAt: nowSec,
      title: opts.title,
      language: opts.language,
      source: {
        file,
        workspace: opts.workspace,
      },
    }

    await call('notification', 'toast', 'Saving snippet to Circles…')

    const snippetCid = await bindings.putJsonLd(snippet)
    const linkName = `snippet/${Date.now()}`

    const linkDraft: CustomDataLink = await buildLinkDraft({
      name: linkName,
      cid: snippetCid,
      chainId: config.chainId,
      signerAddress: avatar,
    })

    const preimage = canonicaliseLink(linkDraft)
    const signature = await signer.signBytes(preimage)
    linkDraft.signature = signature

    const { profile: prof } = await loadProfileOrInit(bindings, avatar)
    const namespaces = isRecord(prof.namespaces) ? prof.namespaces : {}
    const currentIndexCid = (namespaces[config.operatorNamespace] as string | null | undefined) ?? null

    const { index, head } = await loadIndex(bindings, currentIndexCid)
    const { closedHead } = insertIntoHead(head, linkDraft)
    const { indexCid } = await saveHeadAndIndex(bindings, head, index, closedHead)

    const profileCid = await rebaseAndSaveProfile(bindings, avatar, (p) => {
      if (!isRecord(p.namespaces)) {
        p.namespaces = {}
      }
      p.namespaces[config.operatorNamespace] = indexCid
    })

    const txHashRaw = await bindings.updateAvatarProfileDigest(avatar, profileCid)
    const txHash = typeof txHashRaw === 'string' && txHashRaw.trim().length > 0 ? txHashRaw.trim() : undefined

    await call('terminal', 'log', { type: 'log', value: `Circles snippet saved: ${snippetCid}` })
    if (txHash) {
      await call('terminal', 'log', { type: 'log', value: `Profile update tx: ${txHash}` })
    }

    await call('notification', 'toast', 'Snippet saved to Circles profile')
    emit('snippetSaved', { snippetCid, linkName, txHash })

    return { snippetCid, linkName, txHash }
  } catch (err) {
    const message = toErrorMessage(err)
    await call('notification', 'toast', `Circles snippet save failed: ${message}`)
    throw err
  }
}

export async function listSnippets(
  config: CirclesPluginConfig,
  opts: { limit?: number; includePayload?: boolean },
  avatar: string,
  bindings: ProfilesBindings,
  call: (name: string, method: string, ...args: any[]) => Promise<any>
): Promise<CirclesSnippetSummary[]> {
  try {
    const { profile: prof } = await loadProfileOrInit(bindings, avatar)
    const namespaces = isRecord(prof.namespaces) ? prof.namespaces : {}
    const indexCid = (namespaces[config.operatorNamespace] as string | null | undefined) ?? null

    const hasIndex = typeof indexCid === 'string' && indexCid.length > 0
    if (!hasIndex) {
      return []
    }

    const allLinksNewestFirst = await loadLinksNewestFirst(bindings, indexCid)
    const limit = typeof opts.limit === 'number' && Number.isFinite(opts.limit) ? Math.max(1, Math.trunc(opts.limit)) : config.listDefaultLimit
    const sliced = allLinksNewestFirst.slice(0, limit)

    const includePayload = opts.includePayload === true
    if (!includePayload) {
      return sliced.map((l) => ({ name: l.name, cid: l.cid }))
    }

    const payloads = await Promise.all(
      sliced.map(async (l) => {
        const raw = await bindings.getJsonLd(l.cid).catch(() => null)
        if (!raw || !isRecord(raw)) {
          return { link: l, payload: null as CirclesSnippetPayload | null }
        }
        const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : undefined
        const title = typeof raw.title === 'string' ? raw.title : undefined
        const language = typeof raw.language === 'string' ? raw.language : undefined

        let file: string | undefined
        const source = raw.source
        const sourceOk = isRecord(source)
        if (sourceOk) {
          const fileField = source.file
          file = typeof fileField === 'string' ? fileField : undefined
        }

        const payload: CirclesSnippetPayload = {
          '@context': String(raw['@context'] ?? 'https://aboutcircles.com/contexts/circles-gist/'),
          '@type': 'Snippet',
          content: typeof raw.content === 'string' ? raw.content : '',
          createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
          title,
          language,
          source: { file },
        }
        return {
          link: l,
          payload,
        }
      }),
    )

    return payloads.map((x) => ({
      name: x.link.name,
      cid: x.link.cid,
      createdAt: x.payload?.createdAt,
      title: x.payload?.title,
      language: x.payload?.language,
      file: x.payload?.source?.file,
    }))
  } catch (err) {
    const message = toErrorMessage(err)
    await call('notification', 'toast', `Circles listSnippets failed: ${message}`)
    throw err
  }
}

export async function loadLinksNewestFirst(bindings: ProfilesBindings, indexCid: Cid): Promise<CustomDataLink[]> {
  console.log(`circles: loadLinksNewestFirst(bindings: ${bindings}, indexCid: ${indexCid})`)
  const { head, headCid } = await loadIndex(bindings, indexCid)

  const links: CustomDataLink[] = []
  const seenChunkCids = new Set<string>()

  let currentChunk: any = head
  let currentChunkCid: string | null = headCid

  const hasHeadCid = typeof currentChunkCid === 'string' && currentChunkCid.length > 0
  if (hasHeadCid) {
    seenChunkCids.add(currentChunkCid as string)
  }

  while (true) {
    const chunkLinks = Array.isArray(currentChunk?.links) ? (currentChunk.links as CustomDataLink[]) : []
    for (let i = chunkLinks.length - 1; i >= 0; i--) {
      const l = chunkLinks[i]
      const hasName = typeof l?.name === 'string' && l.name.length > 0
      const hasCid = typeof l?.cid === 'string' && l.cid.length > 0
      if (hasName && hasCid) {
        links.push(l)
      }
    }

    const prev = currentChunk?.prev
    const hasPrev = typeof prev === 'string' && prev.length > 0
    if (!hasPrev) {
      break
    }

    const prevCid = prev as string
    const alreadySeen = seenChunkCids.has(prevCid)
    if (alreadySeen) {
      break
    }

    seenChunkCids.add(prevCid)
    currentChunkCid = prevCid
    currentChunk = await bindings.getJsonLd(prevCid)
  }

  return links
}
