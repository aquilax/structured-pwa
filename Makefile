DIST := ./dist
ASSETS := ./assets
SRC := ./src
SRC_FILES := $(shell find $(SRC) -type f -name '*.ts')
resolutions := 48 72 96 144 192 512
ALL_ICONS := $(foreach resolution, $(resolutions), $(DIST)/icon_$(resolution).png)
GIT_HASH := $(shell git rev-parse --short HEAD 2>/dev/null || printf unknown)

all: images copy_assets $(DIST)/sw.js

build: clean-sw $(DIST)/script.js

copy_assets:
	cp $(ASSETS)/* $(DIST)

$(DIST)/script.js: $(SRC)/index.ts $(SRC_FILES)
	./node_modules/.bin/esbuild $< --bundle --define:__GIT_HASH__='"$(GIT_HASH)"' --outfile=$@

$(DIST)/sw.js: workbox-config.js $(DIST)/script.js
	./node_modules/.bin/workbox generateSW $<

images: $(ALL_ICONS)

$(DIST)/icon_%.png: $(ASSETS)/favicon.svg
	inkscape $< -w $* -h $* --export-type=png --export-filename=$@

.PHONY: clean
clean-sw:
	rm -f $(DIST)/workbox*

.PHONY: clean
clean:
	rm -f $(DIST)/*