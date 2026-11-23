# INSTALL — Account Map (flat skill files)

Upload is select-all in this folder (except `SKILL.md`) onto the skill **Files**
button. Directories are encoded in filenames (`__` = `/`). `LAYOUT.txt` tells
the agent how to rebuild the tree.

Then, in a Pod conversation with this skill enabled:

1. Reconstruct `/files/pod-<POD_ID>/AccountMap/` from `LAYOUT.txt`.
2. Replace `__POD_ID__` and `__WORKSPACE_ID__`.
3. Lint the folder, then run `dsbx frame publish` on `manifest.json`.
4. Open and pin that manifest path.

Never `dsbx frame create`. Never `create_interactive_content_file`.
