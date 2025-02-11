# Push with Options

A Visual Studio Code extension that adds a "Push with Options..." command to the Source Control view, allowing you to push the current branch with custom git push options.

## Features

- Adds "Push with Options..." button to Git source control menu
- Supports predefined push options via `.push-options` configuration file
- Supports selecting multiple options at once (using Space key)
- Quick pick menu for common and custom push options
- Works with the current branch
- Shows progress during push operation
- Provides feedback on success/failure

## Configuration

You can define project-specific push options by creating a `.push-options` file in your repository root. Each option should be on a new line, with optional comments starting with `#`. These options will be available for multi-selection along with the default options.

Example `.push-options` file:
```
# Force push to remote
--force-with-lease
# skip running ci after push
--push-option=ci.skip
# run a full pipeline
--push-option=ci.variable="FULL_PIPELINE=true"
# create a merge request after push
--push-option=merge_request.create
# create a draft merge request
--push-option=merge_request.draft
```

The comments above each option will be shown as descriptions in the quick pick menu.

## Requirements

- Git must be installed and available in the system PATH
- VSCode version 1.96.0 or higher

## Usage

1. Open a Git repository in VSCode
2. Open the Source Control view (Ctrl+Shift+G)
3. Right-click on any changed file or the "Changes" group
4. Select "Push with Options..."
5. Select one or more options using Space key
   - Options from your `.push-options` file will appear at the top
   - Common options like --force-with-lease are always available
   - Choose "Custom..." to enter options manually
6. Press Enter to execute the push command with all selected options

## Extension Settings

This extension does not contribute any settings.

## Known Issues

None at this time.

## Release Notes

### 0.0.1

Initial release:
- Add "Push with Options..." command with multi-select support
- Support custom and predefined push options
- Support `.push-options` configuration file
- Show progress and status notifications
