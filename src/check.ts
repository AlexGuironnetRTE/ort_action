import {run_git_clone, get_owner_and_repo, GitRepo} from './git'
import {analyze, evaluate, report} from './ort'
import * as fs from 'fs'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as glob from '@actions/glob'

export async function check_directory(
    input_dir = '.',
    output_dir = '.tortellini/out',
    config_dir = '.tortellini/config'
): Promise<void> {
    await analyze(input_dir, output_dir)
    await evaluate(output_dir, config_dir)
    await report(output_dir)
}

export async function check_urls(
    repositories: string,
    input_dir = '.tortellini/in',
    output_dir = '.tortellini/out',
    config_dir = '.tortellini/config'
): Promise<void> {
    try {
        // read the list of urls from file
        const urls: string[] = fs
            .readFileSync(repositories, 'utf-8')
            .trim()
            .split(/\r?\n/)

        // get repo owner and repo name
        const gitrepos: GitRepo[] = urls.map(get_owner_and_repo)

        // get the total number of repositories
        const n_gitrepos = gitrepos.length

        // clone each repo and run analyze
        for (const [i_gitrepo, gitrepo] of gitrepos.entries()) {
            const {owner, repo, url} = gitrepo
            core.startGroup(`${i_gitrepo + 1}/${n_gitrepos}: ${owner}/${repo}`)
            const input_path = `${input_dir}/${owner}/${repo}`
            const output_path = `${output_dir}/${owner}/${repo}`
            await run_git_clone(url, input_path)
            await check_directory(input_path, output_path, config_dir)
            core.endGroup()
        }

        // clean up input dir
        await io.rmRF(input_dir)

        // clean up intermediate files
        const patterns = [`${output_dir}/*/*/*--result.yml`]
        const globber = await glob.create(patterns.join('\n'), {
            followSymbolicLinks: true
        })
        for await (const ortfile of globber.globGenerator()) {
            console.log(`** removing --> ${ortfile}`)
            await io.rmRF(ortfile)
        }
    } catch (err) {
        console.error(err)
    }
}
