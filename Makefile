DIST := ./dist
ASSETS := ./assets
SRC := ./src
resolutions := 48 72 96 144 192 512
ALL_ICONS := $(foreach resolution, $(resolutions), $(DIST)/icon_$(resolution).png)

all: images copy_assets $(DIST)/sw.js

build: clean-sw $(DIST)/script.js

copy_assets:
	cp $(ASSETS)/* $(DIST)

$(DIST)/script.js: $(SRC)/index.ts $(wildcard $(SRC)/*)
	./node_modules/.bin/esbuild $< --bundle --outfile=$@

$(DIST)/sw.js: workbox-config.js $(DIST)/script.js
	./node_modules/.bin/workbox generateSW $<

images: $(ALL_ICONS)

$(DIST)/icon_%.png: $(ASSETS)/favicon.svg
	inkscape $< -w $* -h $* --export-type=png --export-filename=$@

.PHONY: clean
clean-sw:
	rm $(DIST)/workbox*

.PHONY: clean
clean:
	rm -f $(DIST)/*